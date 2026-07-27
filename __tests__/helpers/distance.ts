export interface Location {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two points using Haversine formula
 * @param point1 First location
 * @param point2 Second location
 * @returns Distance in meters
 */
export const calculateDistance = (point1: Location, point2: Location): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const dLng = (point2.longitude - point1.longitude) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(point1.latitude * Math.PI / 180) * Math.cos(point2.latitude * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
};

/**
 * Check if a point is within a circle
 * @param point Location to check
 * @param center Circle center
 * @param radius Circle radius in meters
 * @returns True if point is within circle
 */
export const isPointInCircle = (
  point: Location,
  center: Location,
  radius: number
): boolean => {
  const distance = calculateDistance(point, center);
  return distance <= radius;
};

/**
 * Check if a task is within alert circle
 * @param taskLat Task latitude
 * @param taskLng Task longitude
 * @param center Alert circle center
 * @param diameter Alert circle diameter in meters
 * @returns True if task is within alert circle
 */
export const isTaskInAlertCircle = (
  taskLat: number,
  taskLng: number,
  center: Location,
  diameter: number
): boolean => {
  const radius = diameter / 2; // Convert diameter to radius
  const taskLocation: Location = { latitude: taskLat, longitude: taskLng };

  return isPointInCircle(taskLocation, center, radius);
};
