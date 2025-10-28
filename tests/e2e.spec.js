const { test, expect } = require('@playwright/test');

test.describe('Game Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should load the login page', async ({ page }) => {
    await expect(page.locator('h2')).toHaveText('Đăng nhập');
  });
});
