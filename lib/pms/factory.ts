import type { PMSApiInterface, PMSApiCredentials, PMSType } from "./types";
import { ClinikoAPI } from "./cliniko-api";
import { HalaxyAPI } from "./halaxy-api";
import { NookalAPI } from "./nookal-api";

export class PMSFactory {
  static createClient(pmsType: PMSType, apiKey: string): PMSApiInterface {
    const credentials: PMSApiCredentials = { apiKey };

    switch (pmsType) {
      case "cliniko":
        return new ClinikoAPI(credentials);
      case "halaxy":
        return new HalaxyAPI(credentials);
      case "nookal":
        return new NookalAPI(credentials);
      default:
        throw new Error(`Unsupported PMS type: ${pmsType}`);
    }
  }

  static getSupportedPMSTypes(): PMSType[] {
    return ["cliniko", "halaxy", "nookal"];
  }

  static validateCredentials(
    pmsType: PMSType,
    credentials: PMSApiCredentials,
  ): boolean {
    if (!credentials.apiKey) {
      console.log("❌ No API key provided");
      return false;
    }

    console.log(`🔍 Validating ${pmsType} credentials:`);
    console.log(`   API Key: ${credentials.apiKey.substring(0, 20)}...`);

    switch (pmsType) {
      case "cliniko":
        const parts = credentials.apiKey.split("-");
        console.log(`   Split parts: ${parts.length}`);
        console.log(
          `   Parts: [${parts.map((p) => `"${p.substring(0, 10)}..."`).join(", ")}]`,
        );

        if (parts.length < 2) {
          console.log(
            `   ❌ Invalid format: needs at least 2 parts separated by '-'`,
          );
          return false;
        }

        const lastPart = parts[parts.length - 1];
        console.log(`   Last part (region): "${lastPart}"`);
        console.log(`   Last part length: ${lastPart.length}`);

        const regionPattern = /^[a-zA-Z0-9]{2,4}$/;
        const isValidRegion = regionPattern.test(lastPart);
        console.log(`   Region validation: ${isValidRegion}`);

        const isValid = parts.length >= 2 && isValidRegion;
        console.log(`   ✅ Validation result: ${isValid}`);
        return isValid;

      case "halaxy":
        return credentials.apiKey.length > 0;
      case "nookal":
        // Nookal API keys follow UUID v4 format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        const nookalPattern =
          /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        const isValidNookal = nookalPattern.test(credentials.apiKey);
        console.log(`   Nookal key format validation: ${isValidNookal}`);
        console.log(`   Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`);
        console.log(`   ✅ Validation result: ${isValidNookal}`);
        return isValidNookal;
      default:
        console.log(`❌ Unsupported PMS type: ${pmsType}`);
        return false;
    }
  }
}

// Also export as PMSApiFactory for backward compatibility
export const PMSApiFactory = PMSFactory;

export default PMSFactory;
