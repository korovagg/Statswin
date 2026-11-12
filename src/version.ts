/**
 * Функция getAppVersion:
 * - Возвращает версию приложения из package.json для отображения в UI.
 */
import pkg from "../package.json";

export function getAppVersion(): string {
  return pkg.version ?? "0.0.0";
}

