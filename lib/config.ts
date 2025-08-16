// Configuration file with environment variables
export const config = {
  //Production DB
  supabase: {
    url: "https://kbsneyhvuhkkshlmnloa.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtic25leWh2dWhra3NobG1ubG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMTU1OTIsImV4cCI6MjA2OTg5MTU5Mn0.PBU7DGi_ystiqCGveVT1vXDoxhNOi7FlMieLbg_NlE4",
    serviceRoleKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtic25leWh2dWhra3NobG1ubG9hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDMxNTU5MiwiZXhwIjoyMDY5ODkxNTkyfQ.YgngnBUB43vtkI44BdXtx5hefyCgUzSGOHxsIOgtQyw",
  },
  //Local DB
  // supabase: {
  //   url: "https://iyielcnhqudbzuisswwl.supabase.co",
  //   anonKey:
  //     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5aWVsY25ocXVkYnp1aXNzd3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNjU0NTEsImV4cCI6MjA3MDc0MTQ1MX0.Yy5C6dp_Z3Z1L-siOIJOG5Fgy8ZdDmUU8xYya-GKzm0",
  //   serviceRoleKey:
  //     "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5aWVsY25ocXVkYnp1aXNzd3dsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTE2NTQ1MSwiZXhwIjoyMDcwNzQxNDUxfQ.Xgptm46wf_r6PN301PSIMaKvg9Vkhb8bxelJgVJkPd8",
  // },
  encryption: {
    secret: "83a22bb4478e7b82a17e27e7ec59c664453ecd630d3cb890cb7e79679b1c5749",
  },
  stripe: {
    secretKey:
      "sk_test_51RspFyIJX4ete5hNwaya2kRd4JsaNrkuYHsmUPcHtXeYmRmdh0BpnUNjENGKmwdwm1p7i4CdD1Wzik0LesrCUtMX00gYC6E19o",
    webhookSecret: "whsec_31rrAnvH5pPgbxpll6VwayHYEuSL69bu",
    publishableKey:
      "pk_test_51RspFyIJX4ete5hNhPe3qg7GKeRog8cYskEgBIrcbfl1YsvC54ZmxSXXBCXJZ2c2kh9HNv2GttOfFdOJJz2qR50R007gjDdOhW",
    priceIds: {
      basic: "price_1Rt6YfIJX4ete5hNsKN3AMf3",
      professional: "price_1Rt5hgIJX4ete5hNG48LhVPM",
      enterprise: "price_1Rt5i4IJX4ete5hNIUKmyZXA",
    },
  },
  app: {
    url: "https://cliniko-v2.vercel.app",
  },
  cron: {
    secret: "your-cron-secret-key-here",
  },
};
