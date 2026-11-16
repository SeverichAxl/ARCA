# Informe Técnico — TSK-BACK-311: Rendimiento de PDF de Contratos y Respaldo Local

| Campo | Detalle |
| :--- | :--- |
| **Tarea** | `TSK-BACK-311` — PDF y respaldo local |
| **Responsable** | Luciana Yahuita Lazarte |
| **Fecha de ejecución** | 2026-11-15 |
| **Ambiente evaluado** | Local Docker (`http://localhost:4000` — API Gateway) |
| **Contrato evaluado (ID)** | `dc2b8c56-4835-436f-94e0-eb52b042541a` |
| **Umbral exigido (DoD)** | Tiempo total de generación y descarga **menor a 3.000 s (3000 ms)** |
| **Resultado global** | **APROBADO (PASS)** — Promedio de **0.397 s** + respaldo local verificado |

---

## 1. Medición de tiempos de generación y descarga

Se ejecutaron tres solicitudes consecutivas al endpoint de descarga de contratos en PDF a través del API Gateway, midiendo tanto la respuesta inicial del endpoint como la transferencia completa del archivo binario:

| Intento | Tiempo Endpoint (ms) | Descarga Binario (ms) | Tiempo Total (ms) | Tiempo Total (s) | HTTP Status | Tamaño | Cabecera / Tipo | ¿Cumple (< 3 s)? |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1** | 20.17 ms | 607.34 ms | 627.51 ms | **0.628 s** | `200 OK` | 11.14 KB | `%PDF-` (`application/pdf`) | **Sí (PASS)** |
| **2** | 22.49 ms | 246.21 ms | 268.70 ms | **0.269 s** | `200 OK` | 11.14 KB | `%PDF-` (`application/pdf`) | **Sí (PASS)** |
| **3** | 22.82 ms | 271.20 ms | 294.02 ms | **0.294 s** | `200 OK` | 11.14 KB | `%PDF-` (`application/pdf`) | **Sí (PASS)** |
| **Promedio** | **21.83 ms** | **374.92 ms** | **396.74 ms** | **0.397 s** | `200 OK` | **11.14 KB** | Válido | **Sí (PASS)** |

---

## 2. Verificación de archivo y respaldo local (Modo sin conexión)

Para garantizar la continuidad de la demostración en caso de falla o ausencia de conexión a internet, se almacenó y verificó criptográficamente una copia física del documento generado:

| Atributo de verificación | Valor registrado |
| :--- | :--- |
| **Ruta del archivo de respaldo** | `docs/qa/respaldos/contrato-respaldo-demo.pdf` |
| **Tamaño exacto** | 11,411 bytes (11.14 KB) |
| **Integridad estructural** | Encabezado binario `%PDF-` validado correctamente |
| **Huella digital (SHA-256)** | `6fe9dfd0720a7fb7d6158bce60aeea38b2bfe3d1b0df9722b9562478abaafa29` |

El servicio cumple holgadamente con el criterio de rendimiento establecido en la definición de terminado (DoD), registrando tiempos inferiores a un segundo incluso en la primera petición en frío (0.628 s) y estabilizándose por debajo de 0.30 s en las peticiones subsecuentes, quedando el archivo de respaldo local disponible para su presentación offline.