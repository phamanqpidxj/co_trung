
from playwright.sync_api import sync_playwright, expect

def run_online_verification(playwright):
    browser = playwright.chromium.launch()

    # --- Test Online User ---
    user_context = browser.new_context()
    user_page = user_context.new_page()
    try:
        print("Testing Online User Mode...")
        user_page.goto("http://localhost:3000")
        user_page.get_by_label("Tên đăng nhập").fill("test_user")
        user_page.get_by_role("button", name="Đăng nhập").click()

        user_page.wait_for_selector("#create-character-form")
        user_page.get_by_label("Tên nhân vật").fill("Online Player")
        user_page.get_by_role("button", name="Xác nhận và bắt đầu").click()

        user_page.wait_for_selector("#game-container")
        expect(user_page.locator("#connection-status")).to_have_text("Trực tuyến")
        expect(user_page.locator("#chat-form")).to_be_visible()
        expect(user_page.locator("#admin-tools")).to_be_hidden()

        user_page.screenshot(path="jules-scratch/verification/02_online_user_mode.png")
        print("Online user mode verification successful.")
    except Exception as e:
        print(f"Error during online user test: {e}")
        user_page.screenshot(path="jules-scratch/verification/02_online_user_mode_ERROR.png")
    finally:
        user_context.close()


    # --- Test Online Admin ---
    admin_context = browser.new_context()
    admin_page = admin_context.new_page()
    try:
        print("\\nTesting Online Admin Mode...")
        admin_page.goto("http://localhost:3000")
        admin_page.get_by_label("Tên đăng nhập").fill("admin")
        admin_page.get_by_label("Mật khẩu").fill("123456")
        admin_page.get_by_role("button", name="Đăng nhập").click()

        admin_page.wait_for_selector("#create-character-form")
        admin_page.get_by_label("Tên nhân vật").fill("Game Master")
        admin_page.get_by_role("button", name="Xác nhận và bắt đầu").click()

        admin_page.wait_for_selector("#game-container")
        expect(admin_page.locator("#connection-status")).to_have_text("Trực tuyến")
        expect(admin_page.locator("#chat-form")).to_be_visible()
        expect(admin_page.locator("#admin-tools")).to_be_visible()

        admin_page.screenshot(path="jules-scratch/verification/03_online_admin_mode.png")
        print("Online admin mode verification successful.")
    except Exception as e:
        print(f"Error during admin test: {e}")
        admin_page.screenshot(path="jules-scratch/verification/03_online_admin_mode_ERROR.png")
    finally:
        admin_context.close()

    browser.close()

with sync_playwright() as p:
    run_online_verification(p)
