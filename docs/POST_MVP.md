# Roadmap post-MVP

## Modelo
- **Dixon-Coles**: corrección de la independencia Poisson para marcadores bajos (0-0, 1-0, 0-1, 1-1).
- **Ratings de fuerza**: Elo / SPI / ratings ofensivos-defensivos en vez de solo medias de goles.
- **Decaimiento temporal**: ponderar partidos recientes con factor de decaimiento exponencial.
- **Bayesiano / shrinkage**: regularizar equipos con pocos partidos hacia la media del torneo.
- **Mercados adicionales**: hándicap asiático, córners, líneas over/under variables (1.5/3.5).
- **Calibración**: curvas de calibración y Brier score; backtesting contra resultados históricos.
- **Cierre de línea (CLV)**: medir el modelo contra la cuota de cierre, no contra el resultado.

## Datos
- Completar los mapeos reales de `providers.ts` (API-Football / Sportmonks / FIFA).
- Tabla de **mapping** `external_id ↔ match.id` y `team` por proveedor.
- Histórico de cuotas (línea temporal) para detectar movimientos de mercado.
- Caché y rate-limiting de las APIs (créditos limitados en The Odds API).
- Deduplicación y normalización de nombres de equipos/casas.

## Producto / UX
- Filtros avanzados (por fase, mercado, casa, rango de EV).
- Comparador de casas por selección (mejor precio disponible).
- Kelly fraccionado **informativo** (con advertencias, nunca como recomendación).
- Alertas/notificaciones de nuevas oportunidades (email/push).
- Modo seguimiento: registrar selecciones y medir CLV/acierto (sin manejar dinero).
- i18n completo, accesibilidad (WCAG AA), modo claro opcional.

## Ingeniería
- Tests unitarios (Vitest) del modelo y devig; e2e (Playwright) de las páginas.
- Materializar `edges` con `refresh` incremental; índices y paginación.
- Autenticación real para `/admin` (Supabase Auth + rol).
- Observabilidad: alertas si un job falla N veces; dashboard de `sync_logs`.
- Rate-limit y validación de inputs en las rutas API.
- Migrar a Next 15 / RSC streaming; revalidación por tags.

## Cumplimiento y responsabilidad
- Verificación de edad y geobloqueo según jurisdicción.
- Enlaces a juego responsable y autoexclusión.
- Términos de uso claros: herramienta analítica, sin garantías.
- Revisión legal del lenguaje (evitar inducción a apostar).
