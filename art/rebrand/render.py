from playwright.sync_api import sync_playwright
import pathlib;d=pathlib.Path('.').resolve()
with sync_playwright() as p:
    b=p.chromium.launch()
    for f,w,h in [('logo',1100,550),('icon',512,512)]:
        pg=b.new_page(viewport={'width':w,'height':h});pg.goto(f'file://{d}/{f}.html');pg.wait_for_timeout(2500);pg.screenshot(path=f'{f}.png')
