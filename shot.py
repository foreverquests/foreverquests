import sys
from playwright.sync_api import sync_playwright
d=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch()
    for name,url,w,h in [('home-desktop','/',1280,1400),('home-mobile','/',390,1600),('item-desktop','/item/skyborne/',1280,1000)]:
        pg=b.new_page(viewport={'width':w,'height':h});pg.goto('http://localhost:4321'+url);pg.wait_for_timeout(1500);pg.screenshot(path=f'{d}/{name}.png');pg.close()
