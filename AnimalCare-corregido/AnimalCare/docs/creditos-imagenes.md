# Creditos de las imagenes

Las fotografias utilizadas en las pantallas de inicio de sesion y registro
proceden de **Pexels** y estan cubiertas por la [Licencia de Pexels](https://www.pexels.com/license/),
que permite su uso gratuito, incluido el uso comercial, sin necesidad de atribucion.
Se documentan aqui por buena practica academica.

| Archivo                          | Descripcion                                      | Fuente |
| -------------------------------- | ------------------------------------------------ | ------ |
| `frontend/public/imagenes/mascotas.jpg`    | Mujer acariciando a sus perros al aire libre     | https://www.pexels.com/photo/7210460/ |
| `frontend/public/imagenes/veterinario.jpg` | Veterinaria revisando a un perro con estetoscopio | https://www.pexels.com/photo/6235650/ |
| `frontend/public/imagenes/gato.jpg`        | Primer plano de un gato                          | https://www.pexels.com/photo/37341478/ |
| `frontend/public/imagenes/cuidado.jpg`     | Hombre abrazando a su perro dalmata              | https://www.pexels.com/photo/5482842/ |

Las imagenes se descargaron y se guardaron dentro del proyecto (no se enlazan
desde internet), por lo que la aplicacion funciona correctamente sin conexion.

## Como cambiar una imagen

1. Coloca la nueva fotografia en `frontend/public/imagenes/`.
2. Usa el mismo nombre de archivo para reemplazarla directamente,
   o edita la lista `ESCENAS` en `frontend/src/components/Carrusel.jsx`.
3. Se recomienda un ancho aproximado de 1200 px para no aumentar el peso de la pagina.
