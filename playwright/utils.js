export async function autoScroll(page, rounds = 15) {
  for (let i = 0; i < rounds; i++) {
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(600);
  }
}
