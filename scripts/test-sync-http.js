const http = require('http');

function makeHttpRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        json: () => Promise.resolve(parsedData),
                        text: () => Promise.resolve(responseData)
                    });
                } catch (e) {
                    resolve({
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        json: () => Promise.resolve({}),
                        text: () => Promise.resolve(responseData)
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(data);
        }

        req.end();
    });
}

async function testSync() {
    try {
        console.log('🚀 Testing Nookal Sync Locally (HTTP Module)...');
        console.log('📍 Endpoint: http://localhost:3000/api/dev/test-sync');

        const postData = JSON.stringify({});

        const response = await makeHttpRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/dev/test-sync',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, postData);

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
