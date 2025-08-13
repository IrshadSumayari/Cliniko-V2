import { createClient } from "@supabase/supabase-js"
import type { Database } from "./types"
import { config } from "@/lib/config"

export const supabase = createClient<Database>(config.supabase.url, config.supabase.anonKey)
