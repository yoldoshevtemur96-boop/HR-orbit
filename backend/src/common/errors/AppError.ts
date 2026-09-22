// Barcha bashorat qilinadigan (operatsion) xatolar shu klassdan meros oladi.
// Middleware buni oddiy JS Error'dan ajratib, foydalanuvchiga tushunarli
// javob qaytaradi; kutilmagan xatolar esa 500 sifatida yopiladi.
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational = true;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static notFound(message = 'Topilmadi') {
    return new AppError(message, 404);
  }

  static forbidden(message = "Ruxsat yo'q") {
    return new AppError(message, 403);
  }

  static unauthorized(message = "Avtorizatsiyadan o'tilmagan") {
    return new AppError(message, 401);
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, 400, details);
  }

  static conflict(message: string) {
    return new AppError(message, 409);
  }
}
