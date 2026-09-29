import { prisma } from '../config/database';
import { ApiError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { verifyDeviceApiKey } from '../utils/helpers';
import { AlertType, AlertSeverity, DeviceStatus } from '@prisma/client';

// ─── Threshold Configuration ──────────────────────────────────────────────────
// In production these should be configurable per-hive in the database
const THRESHOLDS = {
  temperature: { min: 32, max: 38, unit: '°C' },  // Healthy brood temp range
  humidity: { min: 40, max: 70, unit: '%' },
  weight_drop_kg: 2,    // Sudden drop threshold in one reading
  battery_low: 20,      // %
};

// ─── Device Authentication ────────────────────────────────────────────────────

export async function authenticateDevice(
  deviceId: string,
  apiKey: string
): Promise<{ device: { id: string; hiveId: string | null; deviceId: string } }> {
  const device = await prisma.device.findUnique({
    where: { deviceId, deletedAt: null },
    select: { id: true, deviceId: true, hiveId: true, apiKey: true, status: true },
  });

  if (!device) throw ApiError.unauthorized('Device not registered');
  if (device.status === DeviceStatus.DECOMMISSIONED) throw ApiError.forbidden('Device is decommissioned');

  const valid = verifyDeviceApiKey(apiKey, device.apiKey);
  if (!valid) throw ApiError.unauthorized('Invalid device API key');

  return { device };
}

// ─── Telemetry Ingestion ──────────────────────────────────────────────────────

export async function ingestTelemetry(
  deviceId: string,
  data: {
    timestamp: string;
    temperature?: number;
    humidity?: number;
    weight?: number;
    soundLevel?: number;
    co2Level?: number;
    batteryLevel?: number;
    latitude?: number;
    longitude?: number;
    altitude?: number;
    rssi?: number;
    rawPayload?: Record<string, unknown>;
  }
) {
  const device = await prisma.device.findUnique({
    where: { deviceId },
    select: { id: true, hiveId: true },
  });

  if (!device) throw ApiError.notFound('Device not found');

  const recordedAt = new Date(data.timestamp);
  if (isNaN(recordedAt.getTime())) {
    throw ApiError.badRequest('Invalid timestamp format');
  }

  // Store raw telemetry
  const telemetry = await prisma.deviceTelemetry.create({
    data: {
      deviceId: device.id,
      hiveId: device.hiveId,
      temperature: data.temperature,
      humidity: data.humidity,
      weight: data.weight,
      soundLevel: data.soundLevel,
      co2Level: data.co2Level,
      batteryLevel: data.batteryLevel,
      latitude: data.latitude,
      longitude: data.longitude,
      altitude: data.altitude,
      rssi: data.rssi,
      rawPayload: data.rawPayload as object,
      recordedAt,
    },
  });

  // Update device last seen and battery
  await prisma.device.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(),
      batteryLevel: data.batteryLevel ?? undefined,
    },
  });

  // Run anomaly/threshold checks
  await checkThresholdsAndAlert(device.id, device.hiveId, data);

  logger.info('IoT telemetry ingested', {
    deviceId,
    hiveId: device.hiveId,
    recordedAt,
  });

  return { telemetryId: telemetry.id, processedAt: new Date() };
}

// ─── Alert Generation ─────────────────────────────────────────────────────────

async function checkThresholdsAndAlert(
  deviceDbId: string,
  hiveId: string | null,
  data: {
    temperature?: number;
    humidity?: number;
    weight?: number;
    batteryLevel?: number;
  }
) {
  const alertsToCreate: Array<{
    hiveId: string | null;
    deviceId: string;
    alertType: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    metadata: object;
  }> = [];

  if (data.temperature !== undefined) {
    if (data.temperature > THRESHOLDS.temperature.max) {
      alertsToCreate.push({
        hiveId,
        deviceId: deviceDbId,
        alertType: AlertType.TEMPERATURE_HIGH,
        severity: data.temperature > THRESHOLDS.temperature.max + 3 ? AlertSeverity.CRITICAL : AlertSeverity.HIGH,
        title: 'High Hive Temperature',
        message: `Hive temperature ${data.temperature}${THRESHOLDS.temperature.unit} exceeds threshold of ${THRESHOLDS.temperature.max}${THRESHOLDS.temperature.unit}`,
        metadata: { value: data.temperature, threshold: THRESHOLDS.temperature.max, unit: THRESHOLDS.temperature.unit },
      });
    } else if (data.temperature < THRESHOLDS.temperature.min) {
      alertsToCreate.push({
        hiveId,
        deviceId: deviceDbId,
        alertType: AlertType.TEMPERATURE_LOW,
        severity: AlertSeverity.MEDIUM,
        title: 'Low Hive Temperature',
        message: `Hive temperature ${data.temperature}${THRESHOLDS.temperature.unit} is below threshold of ${THRESHOLDS.temperature.min}${THRESHOLDS.temperature.unit}`,
        metadata: { value: data.temperature, threshold: THRESHOLDS.temperature.min, unit: THRESHOLDS.temperature.unit },
      });
    }
  }

  if (data.humidity !== undefined) {
    if (data.humidity > THRESHOLDS.humidity.max) {
      alertsToCreate.push({
        hiveId,
        deviceId: deviceDbId,
        alertType: AlertType.HUMIDITY_HIGH,
        severity: AlertSeverity.MEDIUM,
        title: 'High Hive Humidity',
        message: `Humidity ${data.humidity}% exceeds threshold of ${THRESHOLDS.humidity.max}%`,
        metadata: { value: data.humidity, threshold: THRESHOLDS.humidity.max },
      });
    } else if (data.humidity < THRESHOLDS.humidity.min) {
      alertsToCreate.push({
        hiveId,
        deviceId: deviceDbId,
        alertType: AlertType.HUMIDITY_LOW,
        severity: AlertSeverity.LOW,
        title: 'Low Hive Humidity',
        message: `Humidity ${data.humidity}% is below threshold of ${THRESHOLDS.humidity.min}%`,
        metadata: { value: data.humidity, threshold: THRESHOLDS.humidity.min },
      });
    }
  }

  if (data.batteryLevel !== undefined && data.batteryLevel < THRESHOLDS.battery_low) {
    alertsToCreate.push({
      hiveId,
      deviceId: deviceDbId,
      alertType: AlertType.BATTERY_LOW,
      severity: data.batteryLevel < 10 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
      title: 'IoT Device Low Battery',
      message: `Device battery level is ${data.batteryLevel}%`,
      metadata: { batteryLevel: data.batteryLevel, threshold: THRESHOLDS.battery_low },
    });
  }

  // Check for sudden weight drop (compare with last reading)
  if (data.weight !== undefined && hiveId) {
    const lastReading = await prisma.deviceTelemetry.findFirst({
      where: { hiveId, weight: { not: null } },
      orderBy: { recordedAt: 'desc' },
      skip: 1, // Skip current reading
    });

    if (lastReading?.weight !== null && lastReading?.weight !== undefined) {
      const drop = lastReading.weight - data.weight;
      if (drop > THRESHOLDS.weight_drop_kg) {
        alertsToCreate.push({
          hiveId,
          deviceId: deviceDbId,
          alertType: AlertType.WEIGHT_DROP,
          severity: AlertSeverity.HIGH,
          title: 'Sudden Hive Weight Drop',
          message: `Hive weight dropped by ${drop.toFixed(2)} kg (from ${lastReading.weight} kg to ${data.weight} kg)`,
          metadata: { previousWeight: lastReading.weight, currentWeight: data.weight, drop },
        });
      }
    }
  }

  if (alertsToCreate.length > 0) {
    await prisma.alert.createMany({
      data: alertsToCreate.map((a) => ({
        ...a,
        hiveId: a.hiveId,
        metadata: a.metadata as object,
      })),
    });
    logger.info('Alerts generated from telemetry', {
      count: alertsToCreate.length,
      deviceId: deviceDbId,
    });
  }
}

// ─── Telemetry Queries ────────────────────────────────────────────────────────

export async function getHiveTelemetry(
  hiveId: string,
  hours = 24,
  page = 1,
  limit = 100
) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const [readings, total] = await Promise.all([
    prisma.deviceTelemetry.findMany({
      where: { hiveId, recordedAt: { gte: since } },
      orderBy: { recordedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        temperature: true,
        humidity: true,
        weight: true,
        soundLevel: true,
        co2Level: true,
        batteryLevel: true,
        recordedAt: true,
        anomalyDetected: true,
      },
    }),
    prisma.deviceTelemetry.count({ where: { hiveId, recordedAt: { gte: since } } }),
  ]);

  return { readings, total };
}

export async function getLatestTelemetry(hiveId: string) {
  return prisma.deviceTelemetry.findFirst({
    where: { hiveId },
    orderBy: { recordedAt: 'desc' },
    select: {
      temperature: true,
      humidity: true,
      weight: true,
      soundLevel: true,
      batteryLevel: true,
      recordedAt: true,
    },
  });
}
