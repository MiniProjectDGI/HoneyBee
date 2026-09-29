// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title HoneyChain
 * @notice Batch traceability registry for the Honey Chain platform.
 *
 * @dev This contract stores ONLY integrity metadata (hashes, timestamps).
 *      Sensitive personal data is NEVER stored on-chain.
 *      All detailed information resides in the off-chain PostgreSQL database.
 *
 *      The integrity model:
 *        1. A canonical JSON of a batch event is created off-chain
 *        2. SHA-256 hash of that JSON is stored here
 *        3. Verification: recalculate hash off-chain, compare with on-chain hash
 */
contract HoneyChain {
    // ─── Structs ─────────────────────────────────────────────────────────────

    struct BatchRecord {
        bytes32 batchHash;       // SHA-256 hash of canonical batch data
        uint256 registeredAt;    // Block timestamp of registration
        address registeredBy;    // Registering account
        bool exists;
    }

    struct BatchEvent {
        bytes32 eventHash;       // SHA-256 hash of canonical event data
        string  eventType;       // e.g., "HONEY_COLLECTED", "PACKAGED"
        uint256 eventAt;         // Timestamp (from application, not block)
        uint256 recordedAt;      // Block timestamp
        address recordedBy;
    }

    // ─── State Variables ─────────────────────────────────────────────────────

    address public owner;

    // publicBatchId (as bytes32) → BatchRecord
    mapping(bytes32 => BatchRecord) public batches;

    // publicBatchId → array of BatchEvents (append-only)
    mapping(bytes32 => BatchEvent[]) public batchEvents;

    // Authorized registrars (backend service accounts)
    mapping(address => bool) public registrars;

    // ─── Events ──────────────────────────────────────────────────────────────

    event BatchRegistered(bytes32 indexed publicBatchId, bytes32 batchHash, address registeredBy, uint256 timestamp);
    event BatchEventAdded(bytes32 indexed publicBatchId, bytes32 eventHash, string eventType, uint256 eventAt);
    event RegistrarAdded(address indexed registrar);
    event RegistrarRemoved(address indexed registrar);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "HoneyChain: caller is not owner");
        _;
    }

    modifier onlyRegistrar() {
        require(registrars[msg.sender] || msg.sender == owner, "HoneyChain: not authorized");
        _;
    }

    modifier batchExists(bytes32 _publicBatchId) {
        require(batches[_publicBatchId].exists, "HoneyChain: batch not registered");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        registrars[msg.sender] = true;
    }

    // ─── Registrar Management ─────────────────────────────────────────────────

    function addRegistrar(address _registrar) external onlyOwner {
        registrars[_registrar] = true;
        emit RegistrarAdded(_registrar);
    }

    function removeRegistrar(address _registrar) external onlyOwner {
        registrars[_registrar] = false;
        emit RegistrarRemoved(_registrar);
    }

    // ─── Batch Registration ───────────────────────────────────────────────────

    /**
     * @notice Register a honey batch on-chain.
     * @param _publicBatchId  Public batch identifier (e.g., "HC-202501-ABCDEF") as bytes32
     * @param _batchHash      SHA-256 hash (as bytes32) of the canonical batch JSON from the database
     */
    function registerBatch(
        bytes32 _publicBatchId,
        bytes32 _batchHash
    ) external onlyRegistrar {
        require(!batches[_publicBatchId].exists, "HoneyChain: batch already registered");

        batches[_publicBatchId] = BatchRecord({
            batchHash: _batchHash,
            registeredAt: block.timestamp,
            registeredBy: msg.sender,
            exists: true
        });

        emit BatchRegistered(_publicBatchId, _batchHash, msg.sender, block.timestamp);
    }

    // ─── Batch Event (Append-Only) ────────────────────────────────────────────

    /**
     * @notice Append a traceability event to a registered batch.
     * @param _publicBatchId  Batch identifier
     * @param _eventHash      SHA-256 hash of the canonical event JSON
     * @param _eventType      Event type string (e.g., "HONEY_COLLECTED")
     * @param _eventAt        Application-layer event timestamp (unix seconds)
     */
    function addBatchEvent(
        bytes32 _publicBatchId,
        bytes32 _eventHash,
        string calldata _eventType,
        uint256 _eventAt
    ) external onlyRegistrar batchExists(_publicBatchId) {
        batchEvents[_publicBatchId].push(BatchEvent({
            eventHash: _eventHash,
            eventType: _eventType,
            eventAt: _eventAt,
            recordedAt: block.timestamp,
            recordedBy: msg.sender
        }));

        emit BatchEventAdded(_publicBatchId, _eventHash, _eventType, _eventAt);
    }

    // ─── Verification ─────────────────────────────────────────────────────────

    /**
     * @notice Verify a batch by comparing a provided hash with the stored hash.
     * @param _publicBatchId  Batch identifier
     * @param _hashToVerify   Hash computed off-chain from current database data
     * @return isRegistered   Whether the batch is registered on-chain
     * @return hashMatches    Whether the provided hash matches the stored hash
     * @return registeredAt   Registration timestamp
     * @return storedHash     The hash stored on-chain
     */
    function verifyBatch(
        bytes32 _publicBatchId,
        bytes32 _hashToVerify
    ) external view returns (
        bool isRegistered,
        bool hashMatches,
        uint256 registeredAt,
        bytes32 storedHash
    ) {
        BatchRecord storage record = batches[_publicBatchId];
        isRegistered = record.exists;
        storedHash = record.batchHash;
        registeredAt = record.registeredAt;
        hashMatches = record.exists && (record.batchHash == _hashToVerify);
    }

    /**
     * @notice Get a batch record.
     */
    function getBatch(bytes32 _publicBatchId) external view returns (
        bytes32 batchHash,
        uint256 registeredAt,
        address registeredBy,
        bool exists
    ) {
        BatchRecord storage record = batches[_publicBatchId];
        return (record.batchHash, record.registeredAt, record.registeredBy, record.exists);
    }

    /**
     * @notice Get all event hashes for a batch.
     */
    function getBatchEventCount(bytes32 _publicBatchId) external view returns (uint256) {
        return batchEvents[_publicBatchId].length;
    }

    function getBatchEvent(bytes32 _publicBatchId, uint256 _index) external view returns (
        bytes32 eventHash,
        string memory eventType,
        uint256 eventAt,
        uint256 recordedAt,
        address recordedBy
    ) {
        BatchEvent storage e = batchEvents[_publicBatchId][_index];
        return (e.eventHash, e.eventType, e.eventAt, e.recordedAt, e.recordedBy);
    }

    /**
     * @notice Transfer batch ownership metadata note.
     *         Actual ownership data stays in the off-chain database.
     *         This emits an event for auditability.
     */
    function transferBatch(
        bytes32 _publicBatchId,
        string calldata _transferEventHash,
        uint256 _transferAt
    ) external onlyRegistrar batchExists(_publicBatchId) {
        batchEvents[_publicBatchId].push(BatchEvent({
            eventHash: bytes32(bytes(_transferEventHash)),
            eventType: "BATCH_TRANSFERRED",
            eventAt: _transferAt,
            recordedAt: block.timestamp,
            recordedBy: msg.sender
        }));

        emit BatchEventAdded(_publicBatchId, bytes32(bytes(_transferEventHash)), "BATCH_TRANSFERRED", _transferAt);
    }
}
