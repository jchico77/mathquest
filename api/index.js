import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

const app = express();
const PORT = process.env.PORT || 5000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-pro-preview';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('❌ ERROR: Configura GEMINI_API_KEY en el fichero .env');
    console.error('   Ejemplo: set GEMINI_API_KEY=tu_api_key_aqui');
    if (process.env.NODE_ENV !== 'production') process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

let requestCount = 0;

app.post('/api/evaluate', async (req, res) => {
    const reqId = ++requestCount;
    const startTime = Date.now();
    const timestamp = new Date().toLocaleTimeString('es-ES');

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📥 [#${reqId}] PETICIÓN RECIBIDA - ${timestamp}`);
    console.log(`${'='.repeat(70)}`);

    try {
        const { imageBase64, mimeType, statement, expectedAnswer, hints } = req.body;

        console.log(`📝 Ejercicio: "${statement}"`);
        console.log(`✅ Respuesta esperada: "${expectedAnswer}"`);
        console.log(`🖼️  Imagen: ${mimeType || 'image/jpeg'} | ${imageBase64 ? Math.round(imageBase64.length / 1024) + ' KB (base64)' : '❌ SIN IMAGEN'}`);
        if (hints?.length) console.log(`💡 Pistas: ${hints.join(' | ')}`);

        if (!imageBase64 || !statement) {
            console.log(`❌ [#${reqId}] Faltan datos obligatorios`);
            return res.status(400).json({ error: 'Faltan datos: imageBase64 y statement son obligatorios' });
        }

        const prompt = `Eres un profesor de matemáticas de 2º de la ESO en España, especializado en ayudar a alumnos con TDAH. Tu tono es cercano, motivador y paciente. Nunca uses un tono condescendiente.

EJERCICIO: ${statement}
RESPUESTA CORRECTA ESPERADA: ${expectedAnswer}
${hints ? `PISTAS DEL EJERCICIO: ${hints.join(', ')}` : ''}

INSTRUCCIONES:
1. Observa detenidamente la foto...
...
74: IMPORTANTE: Responde EXCLUSIVAMENTE en JSON válido...
75: {
...
81:   "pasos": ["paso 1 sin numerar...", "paso 2 sin numerar..."],
...
REGLAS DE FORMATO:
- En "pasos", NO pongas números (como "1.") al principio. El frontend ya pone los números.
- En las fórmulas matemáticas, pon espacios alrededor de los signos igual y operadores (ej: " 2 + 3 = 5 ").`;

        console.log(`\n🤖 [#${reqId}] ENVIANDO A ${GEMINI_MODEL}...`);
        console.log(`📤 Prompt (${prompt.length} chars):`);
        console.log(`${'─'.repeat(50)}`);
        console.log(prompt);
        console.log(`${'─'.repeat(50)}`);

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                {
                    inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: imageBase64
                    }
                },
                { text: prompt }
            ]
        });

        const elapsed = Date.now() - startTime;
        const text = response.text;

        console.log(`\n📩 [#${reqId}] RESPUESTA RECIBIDA (${elapsed}ms):`);
        console.log(`${'─'.repeat(50)}`);
        console.log(text);
        console.log(`${'─'.repeat(50)}`);

        // Parse JSON from response, handling possible markdown wrapping
        let parsed;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No JSON found in response');
            }
        } catch (parseErr) {
            console.error(`⚠️  [#${reqId}] ERROR PARSEANDO JSON:`, parseErr.message);
            console.error(`   Raw text: ${text}`);
            parsed = {
                correcto: false,
                respuestaAlumno: 'No se pudo interpretar',
                mensaje: 'Ha habido un problema interpretando tu respuesta. ¡Inténtalo de nuevo con una foto más clara!',
                explicacion: text,
                truco: '',
                pasos: [],
                confianza: 0
            };
        }

        console.log(`\n✨ [#${reqId}] RESULTADO FINAL:`);
        console.log(`   Correcto: ${parsed.correcto ? '✅ SÍ' : '❌ NO'}`);
        console.log(`   Respuesta alumno: "${parsed.respuestaAlumno}"`);
        console.log(`   Mensaje: "${parsed.mensaje}"`);
        console.log(`   Confianza: ${parsed.confianza || 'N/A'}`);
        console.log(`   Tiempo total: ${elapsed}ms`);
        console.log(`${'='.repeat(70)}\n`);

        res.json(parsed);
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`\n💥 [#${reqId}] ERROR (${elapsed}ms):`, error.message);
        console.error(`   Status: ${error.status || 'N/A'}`);
        console.log(`${'='.repeat(70)}\n`);
        res.status(500).json({
            error: 'Error al evaluar la respuesta',
            details: error.message
        });
    }
});

// ===== BATCH EVALUATION ENDPOINT =====
app.post('/api/evaluate-batch', async (req, res) => {
    const reqId = ++requestCount;
    const startTime = Date.now();
    const timestamp = new Date().toLocaleTimeString('es-ES');

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📥 [#${reqId}] PETICIÓN BATCH - ${timestamp}`);
    console.log(`${'='.repeat(70)}`);

    try {
        const { imageBase64, mimeType, batchTitle, items, hints } = req.body;

        console.log(`📋 Batch: "${batchTitle}" (${items?.length || 0} items)`);
        items?.forEach((item, i) => console.log(`   ${i + 1}. ${item.statement} = ${item.answer}`));
        console.log(`🖼️  Imagen: ${mimeType || 'image/jpeg'} | ${imageBase64 ? Math.round(imageBase64.length / 1024) + ' KB' : '❌ SIN IMAGEN'}`);

        if (!imageBase64 || !items?.length) {
            return res.status(400).json({ error: 'Faltan datos: imageBase64 e items son obligatorios' });
        }

        const itemsList = items.map((item, i) => `${i + 1}. ${item.statement} → Respuesta correcta: ${item.answer}`).join('\n');

        const prompt = `Eres un profesor de matemáticas de 2º de la ESO en España, especializado en ayudar a alumnos con TDAH. Tu tono es cercano, motivador y paciente.

LISTA DE 5 CÁLCULOS: "${batchTitle}"
${itemsList}
${hints ? `PISTAS: ${hints.join(', ')}` : ''}

INSTRUCCIONES:
1. El alumno ha resuelto los 5 cálculos en papel. Mira la foto.
2. Identifica las 5 respuestas escritas por el alumno (estarán numeradas o en orden).
3. Compara CADA respuesta con la respuesta correcta.
4. Si no puedes leer alguna respuesta, márcala como "ilegible" (correcto: false, respuestaAlumno: "ilegible").

Responde EXCLUSIVAMENTE en JSON válido, sin markdown ni texto adicional:
{
  "resultados": [
    { "correcto": true/false, "respuestaAlumno": "lo que escribió o 'ilegible'" },
    { "correcto": true/false, "respuestaAlumno": "lo que escribió o 'ilegible'" },
    { "correcto": true/false, "respuestaAlumno": "lo que escribió o 'ilegible'" },
    { "correcto": true/false, "respuestaAlumno": "lo que escribió o 'ilegible'" },
    { "correcto": true/false, "respuestaAlumno": "lo que escribió o 'ilegible'" }
  ],
  "resumen": "mensaje corto tipo '¡4 de 5! ¡Casi perfecto!' o '¡Todos bien, eres un crack!'",
  "explicacion": "si hay errores, explica brevemente los fallos (máx 3 frases)",
  "truco": "un truco útil para este tipo de cálculos"
}`;

        console.log(`\n🤖 [#${reqId}] ENVIANDO BATCH A ${GEMINI_MODEL}...`);
        console.log(`📤 Prompt (${prompt.length} chars):`);
        console.log(`${'─'.repeat(50)}`);
        console.log(prompt);
        console.log(`${'─'.repeat(50)}`);

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [
                { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } },
                { text: prompt }
            ]
        });

        const elapsed = Date.now() - startTime;
        const text = response.text;

        console.log(`\n📩 [#${reqId}] RESPUESTA BATCH (${elapsed}ms):`);
        console.log(`${'─'.repeat(50)}`);
        console.log(text);
        console.log(`${'─'.repeat(50)}`);

        let parsed;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
            if (!parsed?.resultados) throw new Error('Missing resultados array');
        } catch (parseErr) {
            console.error(`⚠️  [#${reqId}] ERROR PARSEANDO BATCH:`, parseErr.message);
            parsed = {
                resultados: items.map(() => ({ correcto: false, respuestaAlumno: '?' })),
                resumen: 'No se pudieron leer bien las respuestas. Intenta con foto más clara.',
                explicacion: '', truco: ''
            };
        }

        const correctCount = parsed.resultados.filter(r => r.correcto).length;
        console.log(`\n✨ [#${reqId}] BATCH RESULT: ${correctCount}/${items.length} correctas (${elapsed}ms)`);
        console.log(`${'='.repeat(70)}\n`);

        res.json(parsed);
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`\n💥 [#${reqId}] BATCH ERROR (${elapsed}ms):`, error.message);
        console.log(`${'='.repeat(70)}\n`);
        res.status(500).json({ error: 'Error al evaluar batch', details: error.message });
    }
});

// ===== HELP ENDPOINT (student doesn't know how to solve it) =====
app.post('/api/help', async (req, res) => {
    const reqId = ++requestCount;
    const startTime = Date.now();
    const timestamp = new Date().toLocaleTimeString('es-ES');

    console.log(`\n${'='.repeat(70)}`);
    console.log(`🆘 [#${reqId}] PETICIÓN DE AYUDA - ${timestamp}`);
    console.log(`${'='.repeat(70)}`);

    try {
        const { statement, expectedAnswer, hints, isBatch, items, batchTitle } = req.body;

        if (isBatch) {
            console.log(`📋 Batch ayuda: "${batchTitle}"`);
        } else {
            console.log(`📝 Ejercicio: "${statement}"`);
        }

        let prompt;
        if (isBatch) {
            const itemsList = items.map((item, i) => `${i + 1}. ${item.statement} → ${item.answer}`).join('\n');
            prompt = `Eres un profesor de mates directo y claro. Un alumno de 2º ESO no sabe resolver estos cálculos. Explícalo sin rodeos, sin metáforas, sin ser excesivamente efusivo. Ve al grano.

EJERCICIOS: "${batchTitle}"
${itemsList}
${hints ? `PISTAS: ${hints.join(', ')}` : ''}

REGLAS: Sé breve. Nada de frases motivacionales largas. Solo matemáticas claras.
- NO numeres los pasos en el array JSON.
- Separa bien los signos matemáticos con espacios (ej: " = ").

Responde en JSON válido:
{
  "mensaje": "frase corta de ánimo (máx 8 palabras)",
  "explicacion": "regla matemática aplicable, directa, 1-2 frases",
  "pasos": ["resuelve ejercicio 1...", "resuelve ejercicio 2..."],
  "truco": "truco corto y práctico, sin adornos"
}`;
        } else {
            prompt = `Eres un profesor de mates directo y claro. Un alumno de 2º ESO no sabe resolver este ejercicio. Explícalo sin rodeos, sin metáforas, sin ser excesivamente efusivo. Ve al grano.

EJERCICIO: ${statement}
RESPUESTA CORRECTA: ${expectedAnswer}
${hints ? `PISTAS: ${hints.join(', ')}` : ''}

REGLAS: Sé breve. Nada de frases motivacionales largas. Solo matemáticas claras.
- NO numeres los pasos.
- Separa bien los signos (ej: " 2 + 2 = 4 ").

Responde en JSON válido:
{
  "mensaje": "frase corta de ánimo (máx 8 palabras)",
  "explicacion": "método para resolver, directo, 1-2 frases",
  "pasos": ["paso 1 sin número...", "paso 2 sin número..."],
  "truco": "truco corto y práctico, sin adornos"
}`;
        }

        console.log(`\n🤖 [#${reqId}] ENVIANDO AYUDA A ${GEMINI_MODEL}...`);

        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ text: prompt }]
        });

        const elapsed = Date.now() - startTime;
        const text = response.text;

        console.log(`\n📩 [#${reqId}] RESPUESTA AYUDA (${elapsed}ms):`);
        console.log(`${'─'.repeat(50)}`);
        console.log(text);
        console.log(`${'─'.repeat(50)}`);

        let parsed;
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
            if (!parsed) throw new Error('No JSON');
        } catch (parseErr) {
            parsed = {
                mensaje: '¡Vamos a aprenderlo!',
                explicacion: text,
                pasos: [],
                truco: ''
            };
        }

        console.log(`✨ [#${reqId}] AYUDA ENVIADA (${elapsed}ms)`);
        console.log(`${'='.repeat(70)}\n`);

        res.json(parsed);
    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`💥 [#${reqId}] HELP ERROR (${elapsed}ms):`, error.message);
        console.log(`${'='.repeat(70)}\n`);
        res.status(500).json({ error: 'Error al generar ayuda', details: error.message });
    }
});

// --- Evaluate Text Endpoint ---
app.post('/api/evaluate-text', async (req, res) => {
    const startTime = Date.now();
    const reqId = Math.random().toString(36).substring(7);
    console.log(`\n🚀 [#${reqId}] EVALUANDO TEXTO...`);

    const { question, userAnswer, correctAnswer, topic } = req.body;

    const prompt = `Eres un profesor de matemáticas divertido y motivador.
TEMA: ${topic}
PREGUNTA: "${question}"
RESPUESTA CORRECTA: "${correctAnswer}"
RESPUESTA ALUMNO: "${userAnswer}"

TAREA: Evalúa si la respuesta del alumno es correcta.
1. Si es correcta (aunque el formato varíe ligeramente, ej: "2.5" vs "2,5"), felicítalo brevemente.
2. Si es incorrecta, explica el error de forma sencilla y da la solución.
3. Si la respuesta es un disparate o está vacía, pide que lo intente de nuevo con una pista.

Responde EXCLUSIVAMENTE en JSON:
{
  "correcto": boolean,
  "respuestaAlumno": "${userAnswer}",
  "explicacion": "Texto breve y motivador (max 2 frases)",
  "pasos": ["Paso 1 (si falló)", "Paso 2 (si falló)"],
  "truco": "Un mini consejo si falló (opcional)"
}`;

    try {
        const result = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ text: prompt }]
        });
        const text = result.text;

        // Clean JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { correcto: false, explicacion: "Error al leer respuesta" };

        console.log(`✨ [#${reqId}] EVALUADO: ${parsed.correcto ? '✅' : '❌'} (${Date.now() - startTime}ms)`);
        res.json(parsed);

    } catch (error) {
        console.error(`💥 [#${reqId}] ERROR:`, error.message);
        res.status(500).json({ error: 'Fallo en evaluación' });
    }
});

// --- Evaluate Batch Text Endpoint ---
app.post('/api/evaluate-batch-text', async (req, res) => {
    const startTime = Date.now();
    const reqId = Math.random().toString(36).substring(7);
    console.log(`\n🚀 [#${reqId}] EVALUANDO LOTE TEXTO...`);

    const { items, userAnswers, topic } = req.body;

    const questionsPrompt = items.map((item, i) =>
        `${i + 1}. Pregunta: "${item.statement}", Respuesta Correcta: "${item.answer}", Respuesta Alumno: "${userAnswers[i] || ''}"`
    ).join('\n');

    const prompt = `Eres un profesor de matemáticas.
TEMA: ${topic}
Tu tarea es evaluar este lote de ${items.length} ejercicios cortos.

${questionsPrompt}

Responde EXCLUSIVAMENTE en JSON:
{
  "resultados": [
    { "correcto": boolean, "respuestaAlumno": "string" },
    ... (uno por ejercicio)
  ],
  "resumen": "Frase motivadora (ej: '3 de 5 bien, ¡vas mejorando!')",
  "truco": "Consejo general si falló varios",
  "explicacion": "Explicación breve de los errores más graves"
}`;

    try {
        const result = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ text: prompt }]
        });
        const text = result.text;

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { resultados: [], resumen: "Error" };

        console.log(`✨ [#${reqId}] LOTE EVALUADO (${Date.now() - startTime}ms)`);
        res.json(parsed);

    } catch (error) {
        console.error(`💥 [#${reqId}] ERROR:`, error.message);
        res.status(500).json({ error: 'Fallo en evaluación lote' });
    }
});

// --- Generate Batch Endpoint ---
app.post('/api/generate-batch', async (req, res) => {
    const startTime = Date.now();
    const reqId = Math.random().toString(36).substring(7);
    console.log(`\n🚀 [#${reqId}] GENERANDO LOTE...`);

    const { statement, answer, topic } = req.body;

    const prompt = `Eres un experto profesor de matemáticas creando ejercicios dinámicos y variados.
TEMA: ${topic}
EJERCICIO BASE: "${statement}" (Respuesta: "${answer}")

TAREA: Genera 4 ejercicios más para completar un lote de 5.
IMPORTANTE: NO te limites a cambiar los números. Busco VARIEDAD en el planteamiento para evitar la monotonía.

REGLAS DE GENERACIÓN:
1. Mismo Nivel de Dificultad: No los hagas más difíciles, pero sí diferentes en su presentación.
2. Variedad de Contexto: Si es un problema verbal, cambia totalmente el escenario (ej: si el original es de submarinos, usa ascensores, temperaturas, cuentas bancarias, años históricos...).
3. Variedad Estructural: Si es cálculo, cambia ligeramente la estructura (orden de operadores, incógnita en otro lado) manteniendo la misma lógica.
4. Creatividad: ¡Sorprende al alumno! Que no parezca una "fotocopia" con otros números.
5. Genera un título temático divertido para el lote.

Responde EXCLUSIVAMENTE en JSON válido:
{
  "batchTitle": "Título del lote",
  "items": [
    { "statement": "ejercicio 1", "answer": "respuesta 1" },
    { "statement": "ejercicio 2", "answer": "respuesta 2" },
    { "statement": "ejercicio 3", "answer": "respuesta 3" },
    { "statement": "ejercicio 4", "answer": "respuesta 4" }
  ],
  "hints": ["pista genérica 1", "pista genérica 2"]
}`;

    try {
        console.log(`📤 Prompt enviado a ${GEMINI_MODEL}`);
        const result = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: [{ text: prompt }]
        });
        const text = result.text;
        console.log(`📩 Respuesta recibida (${text.length} chars)`);

        let parsed;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
        } else {
            throw new Error('No se encontró JSON válido en la respuesta');
        }

        res.json(parsed);
        console.log(`✨ [#${reqId}] LOTE GENERADO (${Date.now() - startTime}ms)`);
    } catch (error) {
        console.error(`💥 [#${reqId}] ERROR GENERANDO LOTE:`, error);
        res.status(500).json({ error: 'Fallo en generación' });
    }
});

app.get('/api/topics', async (req, res) => {
    try {
        console.log('📡 Fetching topics from Supabase...');
        const { data, error } = await supabase
            .from('topics')
            .select('*')
            .order('id');

        if (error) throw error;

        console.log(`✅ Fetched ${data?.length} topics`);
        if (!data || data.length === 0) console.warn('⚠️  DB is empty!');

        res.json(data);
    } catch (error) {
        console.error('💥 Error fetching topics:', error);
        res.status(500).json({ error: 'Error fetching topics' });
    }
});

app.post('/api/save-topic', async (req, res) => {
    try {
        const { id, exercises } = req.body;

        if (!id || !exercises) throw new Error('Faltan datos (id o exercises)');

        console.log(`💾 Guardando tema ID: ${id} (${exercises.length} ejercicios)`);

        const { error } = await supabase
            .from('topics')
            .update({ exercises })
            .eq('id', id);

        if (error) throw error;

        console.log(`✅ Tema actualizado en Supabase`);
        res.json({ success: true });
    } catch (error) {
        console.error('💥 Error guardando tema:', error);
        res.status(500).json({ error: 'Error al guardar tema', details: error.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 MathQuest Server corriendo en http://localhost:${PORT}`);
        console.log(`📡 Usando modelo: ${GEMINI_MODEL}`);
    });
}

export default app;
