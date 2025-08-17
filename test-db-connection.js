// Test database connection and table access
const { createClient } = require("@supabase/supabase-js");

// Load environment variables
require("dotenv").config({ path: ".env.local" });

async function testDatabaseConnection() {
  try {
    console.log("Testing database connection...");

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const encryptionSecret = process.env.ENCRYPTION_SECRET;

    console.log("Environment variables:");
    console.log(
      "- SUPABASE_SERVICE_ROLE_KEY:",
      supabaseServiceKey ? "✅ Set" : "❌ Missing",
    );
    console.log(
      "- ENCRYPTION_SECRET:",
      encryptionSecret ? "✅ Set" : "❌ Missing",
    );

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing required environment variables");
    }

    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log("\n✅ Admin client created successfully");

    // Test basic connection
    console.log("\nTesting basic connection...");
    const { data: testData, error: testError } = await supabase
      .from("users")
      .select("id")
      .limit(1);

    if (testError) {
      console.error("❌ Connection test failed:", testError);
      return;
    }

    console.log("✅ Basic connection successful");

    // Test table access
    console.log("\nTesting table access...");

    const tables = [
      "users",
      "pms_api_keys",
      "patients",
      "appointments",
      "sync_logs",
    ];

    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select("id")
          .limit(1);

        if (error) {
          console.log(`❌ ${table}: ${error.message}`);
        } else {
          console.log(`✅ ${table}: Accessible`);
        }
      } catch (err) {
        console.log(`❌ ${table}: ${err.message}`);
      }
    }

    console.log("\n✅ Database connection test completed");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testDatabaseConnection();
