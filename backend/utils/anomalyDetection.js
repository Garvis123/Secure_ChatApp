import crypto from 'crypto';

// Store user activity patterns (in production, use Redis or database)
const userPatterns = new Map();
const activityLogs = new Map();

// Thresholds for anomaly detection
export const THRESHOLDS = {
  MAX_MESSAGES_PER_MINUTE: 30,
  MAX_MESSAGES_PER_HOUR: 500,
  MAX_LOGIN_ATTEMPTS: 5,
  MAX_FAILED_LOGINS: 3,
  UNUSUAL_TIME_THRESHOLD: 0.3, // 30% deviation from normal pattern
  VELOCITY_THRESHOLD: 1000, // km - location change threshold
  MAX_FILES_PER_HOUR: 20,
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  SESSION_TIMEOUT: 30 * 60 * 1000 // 30 minutes
};

/**
 * Initialize user activity tracking
 */
export function initUserTracking(userId) {
  if (!userPatterns.has(userId)) {
    userPatterns.set(userId, {
      messageCount: [],
      loginTimes: [],
      locations: [],
      devices: [],
      fileUploads: [],
      typicalHours: new Array(24).fill(0),
      averageMessageLength: 0,
      totalMessages: 0
    });
  }
  
  if (!activityLogs.has(userId)) {
    activityLogs.set(userId, []);
  }
}

/**
 * Log user activity
 */
export function logActivity(userId, activityType, metadata = {}) {
  initUserTracking(userId);
  
  const log = {
    type: activityType,
    timestamp: Date.now(),
    metadata,
    id: crypto.randomBytes(8).toString('hex')
  };
  
  const logs = activityLogs.get(userId);
  logs.push(log);
  
  // Keep only last 1000 activities
  if (logs.length > 1000) {
    logs.shift();
  }
  
  activityLogs.set(userId, logs);
  return log;
}

/**
 * Detect message rate anomaly
 */
export function detectMessageRateAnomaly(userId) {
  initUserTracking(userId);
  
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;
  
  const logs = activityLogs.get(userId);
  const messageLogs = logs.filter(log => log.type === 'message_sent');
  
  // Count messages in last minute
  const messagesLastMinute = messageLogs.filter(
    log => log.timestamp > oneMinuteAgo
  ).length;
  
  // Count messages in last hour
  const messagesLastHour = messageLogs.filter(
    log => log.timestamp > oneHourAgo
  ).length;
  
  const anomalies = [];
  
  if (messagesLastMinute > THRESHOLDS.MAX_MESSAGES_PER_MINUTE) {
    anomalies.push({
      type: 'HIGH_MESSAGE_RATE',
      severity: 'high',
      details: `${messagesLastMinute} messages in last minute`,
      threshold: THRESHOLDS.MAX_MESSAGES_PER_MINUTE
    });
  }
  
  if (messagesLastHour > THRESHOLDS.MAX_MESSAGES_PER_HOUR) {
    anomalies.push({
      type: 'EXCESSIVE_MESSAGES',
      severity: 'medium',
      details: `${messagesLastHour} messages in last hour`,
      threshold: THRESHOLDS.MAX_MESSAGES_PER_HOUR
    });
  }
  
  return {
    isAnomaly: anomalies.length > 0,
    anomalies,
    messagesLastMinute,
    messagesLastHour
  };
}

/**
 * Detect unusual login time
 */
export function detectUnusualLoginTime(userId, loginTime = new Date()) {
  initUserTracking(userId);
  
  const pattern = userPatterns.get(userId);
  const hour = loginTime.getHours();
  
  // Update typical hours
  pattern.loginTimes.push(loginTime.getTime());
  pattern.typicalHours[hour]++;
  
  // Calculate if this hour is unusual
  const totalLogins = pattern.loginTimes.length;
  const loginsThisHour = pattern.typicalHours[hour];
  const percentage = totalLogins > 0 ? loginsThisHour / totalLogins : 0;
  
  // Consider unusual if less than 30% of logins happen at this hour
  const isUnusual = totalLogins > 10 && percentage < THRESHOLDS.UNUSUAL_TIME_THRESHOLD;
  
  return {
    isAnomaly: isUnusual,
    hour,
    percentage: (percentage * 100).toFixed(2),
    totalLogins,
    loginsThisHour,
    details: isUnusual ? `Unusual login time: ${hour}:00` : null
  };
}

/**
 * Detect multiple failed login attempts
 */
export function detectFailedLoginAnomaly(userId) {
  const logs = activityLogs.get(userId) || [];
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  
  const recentFailedLogins = logs.filter(
    log => log.type === 'login_failed' && log.timestamp > fiveMinutesAgo
  ).length;
  
  const isAnomaly = recentFailedLogins >= THRESHOLDS.MAX_FAILED_LOGINS;
  
  return {
    isAnomaly,
    failedAttempts: recentFailedLogins,
    threshold: THRESHOLDS.MAX_FAILED_LOGINS,
    severity: isAnomaly ? 'critical' : 'none',
    details: isAnomaly ? `${recentFailedLogins} failed login attempts in 5 minutes` : null
  };
}

/**
 * Detect impossible travel (velocity check)
 */
export function detectImpossibleTravel(userId, newLocation) {
  initUserTracking(userId);
  
  const pattern = userPatterns.get(userId);
  const lastLocation = pattern.locations[pattern.locations.length - 1];
  
  if (!lastLocation) {
    pattern.locations.push({ ...newLocation, timestamp: Date.now() });
    return { isAnomaly: false };
  }
  
  const timeDiff = (Date.now() - lastLocation.timestamp) / 1000 / 60 / 60; // hours
  const distance = calculateDistance(
    lastLocation.lat,
    lastLocation.lon,
    newLocation.lat,
    newLocation.lon
  );
  
  const velocity = distance / timeDiff; // km/h
  const maxReasonableVelocity = 900; // Speed of commercial aircraft
  
  const isAnomaly = velocity > maxReasonableVelocity;
  
  pattern.locations.push({ ...newLocation, timestamp: Date.now() });
  
  // Keep only last 10 locations
  if (pattern.locations.length > 10) {
    pattern.locations.shift();
  }
  
  return {
    isAnomaly,
    distance: distance.toFixed(2),
    timeDiff: timeDiff.toFixed(2),
    velocity: velocity.toFixed(2),
    severity: isAnomaly ? 'high' : 'none',
    details: isAnomaly ? `Impossible travel: ${distance.toFixed(0)}km in ${timeDiff.toFixed(1)}h` : null
  };
}

/**
 * Detect unusual device
 */
export function detectUnusualDevice(userId, deviceFingerprint) {
  initUserTracking(userId);
  
  const pattern = userPatterns.get(userId);
  const deviceHash = crypto.createHash('sha256').update(deviceFingerprint).digest('hex');
  
  const isKnownDevice = pattern.devices.includes(deviceHash);
  
  if (!isKnownDevice) {
    pattern.devices.push(deviceHash);
  }
  
  // Keep only last 5 devices
  if (pattern.devices.length > 5) {
    pattern.devices.shift();
  }
  
  return {
    isAnomaly: !isKnownDevice && pattern.devices.length > 1,
    deviceHash: deviceHash.substring(0, 8),
    knownDevices: pattern.devices.length,
    severity: !isKnownDevice ? 'medium' : 'none',
    details: !isKnownDevice ? 'Login from new device' : null
  };
}

/**
 * Detect file upload anomaly
 */
export function detectFileUploadAnomaly(userId, fileSize) {
  initUserTracking(userId);
  
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const logs = activityLogs.get(userId);
  const fileUploads = logs.filter(
    log => log.type === 'file_upload' && log.timestamp > oneHourAgo
  );
  
  const anomalies = [];
  
  // Check file count
  if (fileUploads.length >= THRESHOLDS.MAX_FILES_PER_HOUR) {
    anomalies.push({
      type: 'EXCESSIVE_FILE_UPLOADS',
      severity: 'medium',
      details: `${fileUploads.length} files uploaded in last hour`
    });
  }
  
  // Check file size
  if (fileSize > THRESHOLDS.MAX_FILE_SIZE) {
    anomalies.push({
      type: 'LARGE_FILE_UPLOAD',
      severity: 'low',
      details: `File size: ${(fileSize / 1024 / 1024).toFixed(2)}MB`
    });
  }
  
  // Check total data uploaded
  const totalDataUploaded = fileUploads.reduce(
    (sum, log) => sum + (log.metadata.fileSize || 0),
    0
  );
  
  if (totalDataUploaded > 200 * 1024 * 1024) { // 200MB
    anomalies.push({
      type: 'EXCESSIVE_DATA_UPLOAD',
      severity: 'medium',
      details: `${(totalDataUploaded / 1024 / 1024).toFixed(2)}MB uploaded in last hour`
    });
  }
  
  return {
    isAnomaly: anomalies.length > 0,
    anomalies,
    fileUploadsLastHour: fileUploads.length,
    totalDataUploaded: (totalDataUploaded / 1024 / 1024).toFixed(2) + 'MB'
  };
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Comprehensive anomaly check
 */
export async function checkAllAnomalies(userId, context = {}) {
  initUserTracking(userId);
  
  const results = {
    userId,
    timestamp: Date.now(),
    anomalies: [],
    riskScore: 0
  };
  
  // Check message rate
  if (context.type === 'message') {
    const messageAnomaly = detectMessageRateAnomaly(userId);
    if (messageAnomaly.isAnomaly) {
      results.anomalies.push(...messageAnomaly.anomalies);
    }
  }
  
  // Check login time
  if (context.type === 'login') {
    const timeAnomaly = detectUnusualLoginTime(userId);
    if (timeAnomaly.isAnomaly) {
      results.anomalies.push({
        type: 'UNUSUAL_LOGIN_TIME',
        severity: 'low',
        details: timeAnomaly.details
      });
    }
  }
  
  // Check failed logins
  const failedLoginAnomaly = detectFailedLoginAnomaly(userId);
  if (failedLoginAnomaly.isAnomaly) {
    results.anomalies.push({
      type: 'MULTIPLE_FAILED_LOGINS',
      severity: failedLoginAnomaly.severity,
      details: failedLoginAnomaly.details
    });
  }
  
  // Check location
  if (context.location) {
    const travelAnomaly = detectImpossibleTravel(userId, context.location);
    if (travelAnomaly.isAnomaly) {
      results.anomalies.push({
        type: 'IMPOSSIBLE_TRAVEL',
        severity: travelAnomaly.severity,
        details: travelAnomaly.details
      });
    }
  }
  
  // Check device
  if (context.deviceFingerprint) {
    const deviceAnomaly = detectUnusualDevice(userId, context.deviceFingerprint);
    if (deviceAnomaly.isAnomaly) {
      results.anomalies.push({
        type: 'NEW_DEVICE',
        severity: deviceAnomaly.severity,
        details: deviceAnomaly.details
      });
    }
  }
  
  // Check file upload
  if (context.type === 'file_upload') {
    const fileAnomaly = detectFileUploadAnomaly(userId, context.fileSize);
    if (fileAnomaly.isAnomaly) {
      results.anomalies.push(...fileAnomaly.anomalies);
    }
  }
  
  // Calculate risk score
  results.riskScore = calculateRiskScore(results.anomalies);
  results.riskLevel = getRiskLevel(results.riskScore);
  
  return results;
}

/**
 * Calculate risk score based on anomalies
 */
export function calculateRiskScore(anomalies) {
  const severityScores = {
    low: 1,
    medium: 3,
    high: 5,
    critical: 10
  };
  
  return anomalies.reduce((score, anomaly) => {
    return score + (severityScores[anomaly.severity] || 0);
  }, 0);
}

/**
 * Get risk level from score
 */
export function getRiskLevel(score) {
  if (score === 0) return 'none';
  if (score <= 3) return 'low';
  if (score <= 7) return 'medium';
  if (score <= 15) return 'high';
  return 'critical';
}

/**
 * Clear user patterns (for testing or user request)
 */
export function clearUserPatterns(userId) {
  userPatterns.delete(userId);
  activityLogs.delete(userId);
}

/**
 * Get user activity summary
 */
export function getUserActivitySummary(userId) {
  const pattern = userPatterns.get(userId);
  const logs = activityLogs.get(userId) || [];
  
  if (!pattern) {
    return null;
  }
  
  return {
    totalActivities: logs.length,
    totalMessages: pattern.totalMessages,
    knownDevices: pattern.devices.length,
    knownLocations: pattern.locations.length,
    mostActiveHours: pattern.typicalHours
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
  };
}

// Minimal helper to match controller's expected import
export function detectAnomaly(messagesLastMinuteCount) {
  return messagesLastMinuteCount > THRESHOLDS.MAX_MESSAGES_PER_MINUTE;
}

export default {
  initUserTracking,
  logActivity,
  detectMessageRateAnomaly,
  detectUnusualLoginTime,
  detectFailedLoginAnomaly,
  detectImpossibleTravel,
  detectUnusualDevice,
  detectFileUploadAnomaly,
  checkAllAnomalies,
  calculateRiskScore,
  getRiskLevel,
  clearUserPatterns,
  getUserActivitySummary,
  THRESHOLDS,
  detectAnomaly
};