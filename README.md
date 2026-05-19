# decelera-webhook-server

Servidor de webhooks para recibir y procesar envíos de formularios de Fillout y almacenarlos en Supabase. Gestiona dos tipos de formularios del programa Decelera: evaluaciones de Challenges y assessments OLBI-BRS.

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/webhook/challenges` | Recibe envíos del formulario de Challenges |
| `POST` | `/webhook/olbi-brs` | Recibe envíos del formulario OLBI-BRS |

### `POST /webhook/challenges`

Recibe respuestas de formularios de evaluación de startups. Identifica al founder por email y guarda los resultados en la columna `challenges` de la tabla `Startup`, estructurados en cuatro secciones:

- `team_culture`
- `sales_growth`
- `marketing_communication`
- `product_technology`

### `POST /webhook/olbi-brs`

Recibe respuestas de los assessments de burnout (OLBI) y estrés (BRS). Identifica a la persona por nombre (matching flexible por palabras) y guarda los resultados en la columna `olbi_brs` de la tabla `Person`.

## Configuración

Crea un archivo `.env` en la raíz con las siguientes variables:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PORT=3000
```

## Instalación y uso

```bash
npm install
node index.js
```

## Stack

- **Node.js** + **Express** — servidor HTTP
- **Supabase** — base de datos PostgreSQL (acceso con service role key)
