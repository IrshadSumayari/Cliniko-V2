// Handle fetch for different Node.js versions
let fetch;
try {
    // Try to use global fetch (Node.js 18+)
    fetch = globalThis.fetch;
} catch (e) {
    try {
        // Try to import node-fetch
        fetch = require('node-fetch');
    } catch (e2) {
        console.error('❌ Fetch not available. Please install node-fetch:');
        console.log('   npm install node-fetch');
        console.log('   or');
        console.log('   pnpm add node-fetch');
        process.exit(1);
    }
}

async function testSync() {
    try {
        console.log('🚀 Testing Nookal Sync Locally...');
        console.log('📍 Endpoint: http://localhost:3000/api/dev/test-sync');

        const response = await fetch('http://localhost:3000/api/dev/test-sync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            console.error(`Error details: ${errorText}`);
            return;
        }

        const result = await response.json();
        console.log('✅ Sync completed successfully!');
        console.log('📊 Results:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('❌ Test failed:', error.message);

        if (error.code === 'ECONNREFUSED') {
            console.log('\n💡 Make sure your Next.js dev server is running:');
            console.log('   npm run dev');
            console.log('   or');
            console.log('   pnpm dev');
        }

        if (error.message.includes('supabaseUrl is required')) {
            console.log('\n💡 Supabase configuration issue detected.');
            console.log('   The sync should now work with the updated code.');
            console.log('   Try running the test again.');
        }
    }
}

// Run the test
testSync();
