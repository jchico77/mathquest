import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

async function fixDuplicatesSafe() {
    console.log('🔍 Buscando duplicados (Modo Seguro)...');

    const { data: topics, error } = await supabase
        .from('topics')
        .select('*')
        .order('id');

    if (error) {
        console.error('Error fetching:', error);
        return;
    }

    const groups = {};
    topics.forEach(t => {
        const title = t.title.trim();
        if (!groups[title]) groups[title] = [];
        groups[title].push(t);
    });

    for (const title in groups) {
        const occurrences = groups[title];
        if (occurrences.length > 1) {
            console.log(`\n🔧 Arreglando "${title}" (${occurrences.length} copias)...`);

            // Sort by ID to find original
            occurrences.sort((a, b) => a.id - b.id);
            const original = occurrences[0];

            // Find the one with MOST exercises (Survivor)
            const survivor = occurrences.reduce((prev, curr) =>
                (curr.exercises?.length || 0) > (prev.exercises?.length || 0) ? curr : prev
            );

            console.log(`   🏆 Sobreviviente ID: ${survivor.id} (${survivor.exercises?.length} ej) vs Original ID: ${original.id} (${original.exercises?.length} ej)`);

            // If Survivor is not Original, copy metadata from Original to Survivor
            if (survivor.id !== original.id) {
                console.log(`   🎨 Copiando estilo de Original a Sobreviviente...`);
                const { error: updateErr } = await supabase
                    .from('topics')
                    .update({
                        color: original.color,
                        icon: original.icon,
                        title: original.title // Ensure casing matches
                    })
                    .eq('id', survivor.id);

                if (updateErr) console.error('   ❌ Error copiando estilo:', updateErr);
            }

            // Identify IDs to delete (Everyone except Survivor)
            const idsToDelete = occurrences
                .filter(t => t.id !== survivor.id)
                .map(t => t.id);

            if (idsToDelete.length > 0) {
                console.log(`   🗑️  Borrando ${idsToDelete.length} duplicados: ${idsToDelete.join(', ')}`);
                const { error: delErr } = await supabase
                    .from('topics')
                    .delete()
                    .in('id', idsToDelete);

                if (delErr) console.error('   ❌ Error borrando:', delErr);
                else console.log('   ✅ Limpieza completada.');
            } else {
                console.log('   ℹ️  Nada que borrar (¿mismo ID?).');
            }
        }
    }
    console.log('\n✨ Limpieza terminada.');
}

fixDuplicatesSafe();
