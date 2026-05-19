import { chromium } from "playwright";

async function run() {

  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage();

  page.on("response", async (response) => {

    const url = response.url();

    if (
      url.includes("api") ||
      url.includes("event") ||
      url.includes("json") ||
      url.includes("wp-json")
    ) {

      console.log("\n=== RESPONSE ===");
      console.log(url);

      try {
        const text = await response.text();

        console.log(text.slice(0, 2000));
      } catch (e) {
        console.log("cannot read");
      }
    }
  });

  await page.goto(
    "https://www.veranstaltung-baden-wuerttemberg.de/?post_type=event&kategorie=&ort=&region=&von=&bis=",
    {
      waitUntil: "networkidle"
    }
  );

  await page.waitForTimeout(10000);

  await browser.close();
}

run();