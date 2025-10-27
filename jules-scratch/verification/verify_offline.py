
from playwright.sync_api import sync_playwright, expect
import os

def run_offline_verification(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()

    try:
        # Set localStorage before navigating to the game page
        login_path = "file://" + os.path.abspath("index.html")
        page.goto(login_path)
        page.evaluate("""
            () => {
                localStorage.setItem('username', 'offline_admin');
                localStorage.setItem('role', 'admin');
                localStorage.setItem('characterName', 'Offline Admin');
            }
        """)

        # Navigate to the game page
        game_path = "file://" + os.path.abspath("game.html")
        page.goto(game_path)

        # Verify offline status and UI elements
        status_element = page.locator("#connection-status")
        expect(status_element).to_have_text("Ngoại tuyến", timeout=7000)
        expect(page.locator("#chat-form")).to_be_hidden()
        expect(page.locator("#admin-tools")).to_be_visible()

        page.screenshot(path="jules-scratch/verification/01_offline_mode.png")
        print("Offline mode verification successful.")

    except Exception as e:
        print(f"Error during offline verification: {e}")
        page.screenshot(path="jules-scratch/verification/01_offline_mode_ERROR.png")

    finally:
        browser.close()

with sync_playwright() as p:
    run_offline_verification(p)
