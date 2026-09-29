import { config } from '../config/env';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';

export type AIModelStatus =
  | 'MODEL_AVAILABLE'
  | 'MODEL_UNAVAILABLE'
  | 'PREDICTION_PENDING'
  | 'PREDICTION_AVAILABLE'
  | 'PREDICTION_FAILED'
  | 'INSUFFICIENT_DATA';

export interface AIAnalysisResult {
  status: AIModelStatus;
  modelVersion: string | null;
  modelProvider: string | null;
  message: string;
  result?: unknown;
}

/**
 * AI Provider Interface.
 *
 * This implements the provider pattern, allowing a real Python ML service
 * to be plugged in by setting AI_SERVICE_URL in environment variables.
 *
 * Until a real model is available, all endpoints return MODEL_UNAVAILABLE
 * with a clear message rather than fabricating predictions.
 */
export class AIProvider {
  private serviceUrl: string;
  private apiKey: string;
  private isAvailable: boolean;

  constructor() {
    this.serviceUrl = config.ai.serviceUrl;
    this.apiKey = config.ai.apiKey;
    this.isAvailable = !!this.serviceUrl;

    if (!this.isAvailable) {
      logger.info('AI service not configured — AI features in MODEL_UNAVAILABLE state');
    }
  }

  private async callAIService(
    endpoint: string,
    payload: unknown
  ): Promise<{ success: boolean; data?: unknown; error?: string }> {
    try {
      const response = await fetch(`${this.serviceUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (!response.ok) {
        return { success: false, error: `AI service responded with status ${response.status}` };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI service call failed';
      logger.error('AI service call failed', { endpoint, error: message });
      return { success: false, error: message };
    }
  }

  /**
   * Disease detection from a hive/bee image.
   *
   * The result includes a mandatory disclaimer that this is ML-assisted
   * and not a definitive diagnosis.
   */
  async detectDisease(params: {
    analysisId: string;
    imageUrl: string;
    hiveId?: string;
  }): Promise<AIAnalysisResult> {
    if (!this.isAvailable) {
      await this.updateAnalysisStatus(params.analysisId, 'MODEL_UNAVAILABLE');
      return {
        status: 'MODEL_UNAVAILABLE',
        modelVersion: null,
        modelProvider: null,
        message:
          'Disease detection model is not currently configured. ' +
          'Connect an AI inference service via AI_SERVICE_URL to enable this feature.',
      };
    }

    await this.updateAnalysisStatus(params.analysisId, 'PREDICTION_PENDING');

    const result = await this.callAIService('/disease-detection', {
      imageUrl: params.imageUrl,
      hiveId: params.hiveId,
    });

    if (!result.success) {
      await this.updateAnalysisStatus(params.analysisId, 'PREDICTION_FAILED');
      return {
        status: 'PREDICTION_FAILED',
        modelVersion: null,
        modelProvider: null,
        message: `AI service error: ${result.error}`,
      };
    }

    await this.updateAnalysisStatus(params.analysisId, 'PREDICTION_AVAILABLE', result.data as Record<string, unknown>);

    return {
      status: 'PREDICTION_AVAILABLE',
      modelVersion: (result.data as Record<string, string>)?.modelVersion || null,
      modelProvider: this.serviceUrl,
      message: 'Disease analysis complete. Review results with a qualified apiculture expert.',
      result: result.data,
    };
  }

  /**
   * Colony health assessment from sensor data.
   *
   * If enough sensor data exists, uses rule-based scoring.
   * For ML-based scoring, the external service is needed.
   */
  async assessColonyHealth(hiveId: string): Promise<AIAnalysisResult> {
    // Attempt rule-based assessment from sensor data
    const recentTelemetry = await prisma.deviceTelemetry.findMany({
      where: { hiveId, recordedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { recordedAt: 'desc' },
      take: 100,
      select: { temperature: true, humidity: true, weight: true, recordedAt: true },
    });

    if (recentTelemetry.length < 5) {
      return {
        status: 'INSUFFICIENT_DATA',
        modelVersion: null,
        modelProvider: 'rule-based',
        message:
          'Insufficient sensor data for colony health assessment. ' +
          'At least 5 telemetry readings in the last 7 days are required.',
      };
    }

    // Rule-based scoring from available sensor data
    const temps: number[] = recentTelemetry
      .map((t: { temperature: number | null }) => t.temperature)
      .filter((t: number | null): t is number => t !== null);
    const weights: number[] = recentTelemetry
      .map((t: { weight: number | null }) => t.weight)
      .filter((w: number | null): w is number => w !== null);

    const avgTemp = temps.length ? temps.reduce((a: number, b: number) => a + b, 0) / temps.length : null;
    const weightTrend = weights.length >= 2 ? weights[0] - weights[weights.length - 1] : null;

    const issues: string[] = [];
    let healthScore = 100;

    if (avgTemp !== null) {
      if (avgTemp > 38 || avgTemp < 32) {
        healthScore -= 20;
        issues.push(`Average temperature ${avgTemp.toFixed(1)}°C is outside the healthy brood range (32–38°C)`);
      }
    }

    if (weightTrend !== null && weightTrend < -5) {
      healthScore -= 15;
      issues.push(`Weight trend shows a decline of ${Math.abs(weightTrend).toFixed(1)} kg over 7 days`);
    }

    const openAlerts = await prisma.alert.count({
      where: { hiveId, status: 'OPEN' },
    });
    if (openAlerts > 0) {
      healthScore -= openAlerts * 5;
      issues.push(`${openAlerts} unresolved alert(s) active`);
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      status: 'PREDICTION_AVAILABLE',
      modelVersion: 'rule-based-v1',
      modelProvider: 'local',
      message:
        'Health assessment based on sensor thresholds and alert history. ' +
        'For disease-specific analysis, connect an ML model via AI_SERVICE_URL.',
      result: {
        healthScore,
        healthCategory:
          healthScore >= 80 ? 'GOOD' : healthScore >= 60 ? 'FAIR' : healthScore >= 40 ? 'POOR' : 'CRITICAL',
        issues,
        dataPoints: recentTelemetry.length,
        avgTemperature: avgTemp,
        weightTrend7Days: weightTrend,
        openAlerts,
        disclaimer:
          'This is a rule-based assessment using IoT sensor data. It is not a substitute for physical hive inspection.',
      },
    };
  }

  /**
   * Productivity prediction.
   */
  async predictProductivity(hiveId: string): Promise<AIAnalysisResult> {
    if (!this.isAvailable) {
      // Attempt data-driven estimation if enough history exists
      const historicalBatches = await prisma.honeyCollection.count({
        where: { hiveId },
      });

      if (historicalBatches < 3) {
        return {
          status: 'INSUFFICIENT_DATA',
          modelVersion: null,
          modelProvider: null,
          message:
            'Insufficient historical collection data for productivity prediction. ' +
            `This hive has ${historicalBatches} collection record(s). At least 3 are needed.`,
        };
      }

      return {
        status: 'MODEL_UNAVAILABLE',
        modelVersion: null,
        modelProvider: null,
        message:
          'Productivity prediction model is not configured. ' +
          `Historical data exists (${historicalBatches} collections). ` +
          'Connect an AI inference service via AI_SERVICE_URL to enable ML-based predictions.',
      };
    }

    const result = await this.callAIService('/productivity-prediction', { hiveId });

    if (!result.success) {
      return {
        status: 'PREDICTION_FAILED',
        modelVersion: null,
        modelProvider: null,
        message: `AI service error: ${result.error}`,
      };
    }

    return {
      status: 'PREDICTION_AVAILABLE',
      modelVersion: (result.data as Record<string, string>)?.modelVersion || null,
      modelProvider: this.serviceUrl,
      message: 'Productivity prediction complete.',
      result: result.data,
    };
  }

  private async updateAnalysisStatus(
    analysisId: string,
    status: AIModelStatus,
    rawResponse?: Record<string, unknown>
  ) {
    await prisma.aIAnalysis.update({
      where: { id: analysisId },
      data: {
        status,
        ...(status === 'PREDICTION_AVAILABLE' || status === 'PREDICTION_FAILED' ? { completedAt: new Date() } : {}),
        ...(rawResponse ? { rawResponse: rawResponse as any } : {}),
      },
    });
  }
}

export const aiProvider = new AIProvider();
