import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL_NAME = 'gemini-2.0-flash'; // Flash is good for high volume text/vision

const PDF_DIR = './pdfs';

async function processPdf(filename) {
    console.log(`\n📄 Procesando: ${filename}...`);
    const filePath = path.join(PDF_DIR, filename);
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');

    const prompt = `Eres un experto profesor de matemáticas.
Tu tarea es extraer TODOS los ejercicios de este documento PDF y formatearlos para una aplicación educativa.

INSTRUCCIONES:
1. Analiza el contenido matemático del PDF.
2. Extrae los ejercicios tipo "problema" o "cálculo" que sean adecuados para alumnos de secundaria (ESO).
3. Genera un título para el tema basado en el contenido (ej: "Números Enteros", "Fracciones").
4. Elige un icono emoji y un color hexadecimal para el tema.
5. Formatea cada ejercicio en JSON.

IMPORTANTE:
- Si el ejercicio tiene solución en el PDF, úsala. Si no, resuélvelo tú mismo correctamente.
- Ignora teoría, índices o introducciones. Solo ejercicios prácticos.
- Si hay muchos ejercicios, extrae al menos 20 variados.

Responde EXCLUSIVAMENTE en JSON válido con este formato:
{
  "title": "Título del Tema",
  "icon": "📝",
  "color": "#FF5733",
  "exercises": [
    {
      "statement": "Enunciado claro del ejercicio",
      "answer": "Respuesta correcta (concisa)",
      "hints": ["pista 1", "pista 2"],
      "difficulty": "easy/medium/hard"
    },
    ...
  ]
}`;

    try {
        const result = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [
                {
                    inlineData: {
                        mimeType: 'application/pdf',
                        data: base64Data
                    }
                },
                { text: prompt }
            ]
        });

        const text = result.text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found');

        const data = JSON.parse(jsonMatch[0]);
        console.log(`✅ Extraídos ${data.exercises.length} ejercicios. Tema: ${data.title}`);

        // Insert into Supabase
        const { error } = await supabase
            .from('topics')
            .insert({
                title: data.title,
                icon: data.icon,
                color: data.color,
                exercises: data.exercises
            });

        if (error) throw error;
        console.log(`💾 Guardado en Supabase OK.`);

    } catch (error) {
        console.error(`💥 Error procesando ${filename}:`, error.message);
    }
}

async function main() {
    if (!fs.existsSync(PDF_DIR)) {
        console.error('❌ No existe carpeta pdfs');
        return;
    }

    const files = fs.readdirSync(PDF_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
    console.log(`📂 Encontrados ${files.length} PDFs.`);

    for (const file of files) {
        await processPdf(file);
    }
    console.log('\n✨ Proceso completado.');
}

main();
