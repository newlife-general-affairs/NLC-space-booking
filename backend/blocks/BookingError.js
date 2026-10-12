/**
 * BookingError
 * 
 * Custom error class for booking-related operations.
 * Allows throwing validation or business logic errors with matching HTTP status codes.
 */
class BookingError extends Error {
  /**
   * @param {string} message - Error description.
   * @param {number} status - HTTP status code.
   */
  constructor(message, status = 400) {
    super(message);
    this.name = 'BookingError';
    this.status = status;
  }
}

module.exports = BookingError;
