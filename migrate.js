import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

const DATA_DIR = path.join(__dirname, 'src/data');
const FILES = [
    'enteros.json',
    'potencias.json',
    'fracciones.json',
    'fracciones-ops.json',
    'porcentajes.json',
    'probabilidad.json',
    'algebra.json'
];

async function migrate() {
    console.log('🚀 Iniciando migración a Supabase...');

    // Limpiar tabla actual (opcional, para evitar duplicados si se corre varias veces)
    // await supabase.from('topics').delete().neq('id', 0);

    for (const file of FILES) {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Archivo no encontrado: ${file}`);
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        console.log(`📤 Migrando: ${data.topic}...`);

        // Check if exists
        const { data: existing } = await supabase
            .from('topics')
            .select('id')
            .eq('title', data.topic)
            .single();

        if (existing) {
            console.log(`   🔄 Actualizando existente (ID: ${existing.id})`);
            const { error } = await supabase
                .from('topics')
                .update({
                    icon: data.icon,
                    color: data.color,
                    exercises: data.exercises
                })
                .eq('id', existing.id);
            if (error) console.error('Error actualizando:', error);
        } else {
            console.log(`   ✨ Creando nuevo`);
            const { error } = await supabase
                .from('topics')
                .insert({
                    title: data.topic,
                    icon: data.icon,
                    color: data.color,
                    exercises: data.exercises
                });
            if (error) console.error('Error insertando:', error);
        }
    }

    console.log('✅ Migración completada.');
}

migrate();
