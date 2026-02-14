import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

async function fixDuplicates() {
    console.log('🔍 Buscando duplicados...');

    // Fetch all topics
    const { data: topics, error } = await supabase
        .from('topics')
        .select('*')
        .order('id');

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    // Group by normalized title
    const groups = {};
    topics.forEach(t => {
        const title = t.title.trim();
        if (!groups[title]) groups[title] = [];
        groups[title].push(t);
    });

    console.log(`📋 Total temas: ${topics.length}. Temas únicos: ${Object.keys(groups).length}`);

    for (const title in groups) {
        const occurrences = groups[title];
        if (occurrences.length > 1) {
            console.log(`\n🔧 Arreglando "${title}" (${occurrences.length} copias)...`);

            // Sort by ID (usually original is first)
            occurrences.sort((a, b) => a.id - b.id);

            const original = occurrences[0];
            const duplicates = occurrences.slice(1);

            // Merge exercises
            let allExercises = [...(original.exercises || [])];

            duplicates.forEach(d => {
                if (d.exercises) {
                    allExercises = [...allExercises, ...d.exercises];
                }
            });

            // Remove EXACT duplicate exercises (by statement)
            const uniqueExercises = [];
            const seenStatements = new Set();

            allExercises.forEach(ex => {
                const stmt = ex.statement.trim();
                if (!seenStatements.has(stmt)) {
                    seenStatements.add(stmt);
                    uniqueExercises.push(ex);
                }
            });

            console.log(`   📝 Ejercicios: ${original.exercises?.length || 0} -> ${uniqueExercises.length} (tras merge)`);
            console.log(`   Payload size: ${JSON.stringify(uniqueExercises).length} chars`);

            try {
                // Strategy: Keep the NEWEST one (likely keeps the PDF exercises + metadata)?
                // No, user prefers ORIGINAL metadata (colors).
                // Try updating ORIGINAL with new exercises.
                // If it crashes, try chunking? Or simple update.

                const { error: updateErr } = await supabase
                    .from('topics')
                    .update({ exercises: uniqueExercises })
                    .eq('id', original.id);

                if (updateErr) {
                    console.error('   ❌ Error actualizando original:', updateErr);
                } else {
                    console.log('   ✅ Original actualizado.');

                    // Delete duplicates
                    const idsToDelete = duplicates.map(d => d.id);
                    const { error: delErr } = await supabase
                        .from('topics')
                        .delete()
                        .in('id', idsToDelete);

                    if (delErr) console.error('   ❌ Error borrando duplicados:', delErr);
                    else console.log('   🗑️  Duplicados borrados.');
                }
            } catch (err) {
                console.error('   💥 Crash en update:', err);
            }
        }
    }
    console.log('\n✨ Limpieza terminada.');
}

fixDuplicates();
