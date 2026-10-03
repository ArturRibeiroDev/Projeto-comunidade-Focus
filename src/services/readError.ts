export function throwReadError(resource: string, source: string, error: { code?: string }): never {
  if (import.meta.env.DEV)
    console.error(`[FocusAcademy] Falha ao consultar ${source}`, {
      code: error.code ?? 'unknown',
    });
  throw new Error(`Não foi possível carregar ${resource}.`);
}
