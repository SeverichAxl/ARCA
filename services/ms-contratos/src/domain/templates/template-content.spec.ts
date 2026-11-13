import {
  extractVariables,
  PlantillaContentError,
  prepareTemplateContent,
} from './template-content';
import { CONTRATO_VARIABLES } from './template.models';

function captureError(action: () => void): PlantillaContentError {
  try {
    action();
  } catch (error) {
    if (error instanceof PlantillaContentError) return error;
    throw error;
  }
  throw new Error('Se esperaba un PlantillaContentError.');
}

describe('prepareTemplateContent', () => {
  it('conserva las etiquetas del modelo estándar y detecta el catálogo completo', () => {
    const html = [
      '<h1>Contrato de trabajo</h1>',
      '<p>Yo {{nombre_empleado}}, CI {{ci}}, cargo {{cargo}}.</p>',
      '<p>Remuneración {{remuneracion}}, ingreso {{fecha_ingreso}}, prueba {{duracion_prueba}}.</p>',
      '<h2>Cláusulas</h2>',
      '<ol><li>Primera</li><li>Segunda</li></ol>',
      '<table><tbody><tr><td>Dato</td></tr></tbody></table>',
    ].join('');

    const result = prepareTemplateContent(html);

    expect(result.variablesDetectadas).toEqual([...CONTRATO_VARIABLES]);
    expect(result.contenidoHtml).toContain('<h1>Contrato de trabajo</h1>');
    expect(result.contenidoHtml).toContain('<ol><li>Primera</li><li>Segunda</li></ol>');
    expect(result.contenidoHtml).toContain('<table><tbody><tr><td>Dato</td></tr></tbody></table>');
  });

  it('elimina scripts, iframes y atributos ejecutables (XSS)', () => {
    const result = prepareTemplateContent(
      '<h1 onclick="alert(1)">Contrato</h1>' +
        '<script>alert("xss")</script>' +
        '<iframe src="https://malicioso.example"></iframe>' +
        '<p>Hola {{nombre_empleado}}</p>',
    );

    expect(result.contenidoHtml).toBe('<h1>Contrato</h1><p>Hola {{nombre_empleado}}</p>');
    expect(result.contenidoHtml).not.toContain('onclick');
    expect(result.contenidoHtml).not.toContain('<script');
    expect(result.contenidoHtml).not.toContain('<iframe');
  });

  it('conserva estilos editoriales permitidos y descarta estilos peligrosos', () => {
    const result = prepareTemplateContent(
      '<p style="text-align:center; background:url(javascript:alert(1)); color:red">' +
        'Hola {{ci}}</p>',
    );

    expect(result.contenidoHtml).toContain('text-align:center');
    expect(result.contenidoHtml).not.toContain('javascript');
    expect(result.contenidoHtml).not.toContain('background');
    expect(result.contenidoHtml).not.toContain('color:red');
  });

  it('rechaza una variable fuera de la whitelist sin duplicar nombres', () => {
    const error = captureError(() =>
      prepareTemplateContent('<p>{{nombre_empleado}} {{sueldo}} {{sueldo}}</p>'),
    );

    expect(error.code).toBe('CONTR_VARIABLE_NO_PERMITIDA');
    expect(error.details).toEqual({ variables: ['sueldo'] });
  });

  it('rechaza placeholders malformados', () => {
    const error = captureError(() => prepareTemplateContent('<p>{{ nombre_empleado }}</p>'));

    expect(error.code).toBe('CONTR_TEMPLATE_INVALIDA');
  });

  it('rechaza placeholders sin llaves de cierre', () => {
    const error = captureError(() => prepareTemplateContent('<p>{{nombre_empleado</p>'));

    expect(error.code).toBe('CONTR_TEMPLATE_INVALIDA');
  });

  it('rechaza una plantilla sin contenido visible después de sanear', () => {
    const error = captureError(() => prepareTemplateContent('<script>alert("xss")</script>'));

    expect(error.code).toBe('CONTR_TEMPLATE_INVALIDA');
  });

  it('devuelve las variables en orden de aparición y sin duplicados', () => {
    expect(extractVariables('<p>{{ci}} {{nombre_empleado}} {{ci}}</p>')).toEqual([
      'ci',
      'nombre_empleado',
    ]);
  });
});
