"""Prueba local: python tests/verify_gallery.py (requiere playwright y Chrome)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import mkdtemp
from threading import Thread
from urllib.parse import parse_qs, urlparse
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = Path(mkdtemp(prefix="bicicletero-qa-"))

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
base = f"http://127.0.0.1:{server.server_port}"
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        errors, requests = [], []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: requests.append(request.url))
        page.goto(base + "/por-identificar.html")
        assert page.locator("#galeria .card").count() == 8
        assert not any("bicicleteros.json" in url or "bicicleteros-data.js" in url for url in requests)
        for photo in page.locator(".bike-photo").all():
            photo.scroll_into_view_if_needed()
            photo.evaluate("img => img.decode()")
        page.evaluate("window.scrollTo(0,0)")
        page.screenshot(path=str(ARTIFACTS / "desktop.png"), full_page=True)
        page.get_by_label("Buscar por código, color, marca o detalle").fill("canasto")
        assert page.locator("#galeria .card").count() == 1 and page.locator("#SR-004").count() == 1
        page.get_by_role("button", name="Limpiar filtros").click()
        page.get_by_label("Ampliar fotografía de SR-002", exact=True).click()
        assert page.locator("#photoViewer").is_visible()
        assert "2_sreg.jpeg" in page.locator("#fullPhoto").get_attribute("src")
        page.keyboard.press("Escape")
        page.locator('#SR-002 [data-claim]').click()
        page.get_by_role("button", name="Preparar solicitud").click()
        assert page.locator("#claimResult").is_hidden()
        page.get_by_label("Nombre completo", exact=True).fill("Residente de prueba")
        page.get_by_label("Departamento", exact=True).fill("TEST-01")
        page.get_by_label("Teléfono o correo de contacto", exact=True).fill("prueba@example.invalid")
        page.get_by_label("¿Cómo puedes acreditar que es tuya?", exact=True).fill("Tengo una fotografía anterior y la llave del candado.")
        page.locator("#claimConsent").check()
        page.get_by_role("button", name="Preparar solicitud").click()
        parsed = urlparse(page.locator("#whatsappClaim").get_attribute("href"))
        message = parse_qs(parsed.query)["text"][0]
        assert parsed.netloc == "wa.me" and parsed.path == "/56935926232"
        assert "SR-002" in message and "Residente de prueba" in message and "TEST-01" in message
        assert "aún no enviada" in page.locator("#resultTitle").inner_text()
        assert page.evaluate("localStorage.length") == 0
        page.screenshot(path=str(ARTIFACTS / "claim.png"))
        page.get_by_label("Departamento", exact=True).fill("TEST-02")
        assert page.locator("#claimResult").is_hidden()
        assert page.locator("#whatsappClaim").get_attribute("href") is None
        page.get_by_label("Cerrar solicitud", exact=True).click()
        page.locator('#SR-003 [data-claim]').click()
        assert page.locator("#claimName").input_value() == ""
        page.keyboard.press("Escape")
        page.get_by_role("button", name="Compartir galería", exact=True).click()
        assert page.locator("#copyGalleryLink").is_hidden()
        page.get_by_role("button", name="Cerrar", exact=True).click()
        page.get_by_label("Estado", exact=True).select_option("registrada")
        assert page.locator("#galeria .card").count() == 0
        page.get_by_role("button", name="Limpiar filtros").click()
        mobile = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, device_scale_factor=1)
        mobile.goto(base + "/por-identificar.html")
        for photo in mobile.locator(".bike-photo").all():
            photo.scroll_into_view_if_needed()
            photo.evaluate("img => img.decode()")
        mobile.evaluate("window.scrollTo(0,0)")
        assert mobile.evaluate("document.documentElement.scrollWidth <= innerWidth")
        mobile.screenshot(path=str(ARTIFACTS / "mobile.png"), full_page=True)
        mobile.locator('#SR-001 [data-claim]').click()
        assert mobile.locator("#claimDialog").evaluate("el => el.scrollWidth <= el.clientWidth")
        mobile.screenshot(path=str(ARTIFACTS / "mobile-claim.png"))
        page.goto((ROOT / "por-identificar.html").as_uri())
        assert page.locator("#galeria .card").count() == 8
        page.goto(base + "/index.html")
        page.wait_for_function("document.querySelector('#listado').getAttribute('aria-busy') === 'false'")
        assert page.locator("#listado .card").count() == len(json.loads((ROOT / "bicicleteros.json").read_text(encoding="utf-8-sig"))["registros"])
        page.get_by_role("link", name="Ver bicicletas por identificar →", exact=True).click()
        assert page.locator("#galeria .card").count() == 8
        # La impresión incluye todas las fichas, incluso tras una búsqueda.
        page.get_by_label("Buscar por código, color, marca o detalle").fill("SR-002")
        page.evaluate("window.print = () => { window.printCalled = true; }")
        page.get_by_role("button", name="Imprimir galería", exact=True).click()
        page.wait_for_function("window.printCalled === true")
        assert page.locator("#galeria .card").count() == 8
        assert page.locator(".bike-photo").evaluate_all("imgs => imgs.every(img => img.complete && img.naturalWidth > 0)")
        page.emulate_media(media="print")
        page.screenshot(path=str(ARTIFACTS / "print.png"), full_page=True)
        page.emulate_media(media="screen")
        # Los estados solo cambian desde los datos mantenidos por administración.
        fixture = (ROOT / "por-identificar-data.js").read_text(encoding="utf-8")
        fixture = fixture.replace("estado: 'pendiente'", "estado: 'revision'", 1)
        fixture = fixture.replace("estado: 'pendiente'", "estado: 'registrada'", 1)
        page.route("**/por-identificar-data.js", lambda route: route.fulfill(body=fixture, content_type="text/javascript"))
        page.reload()
        assert page.locator('#SR-001 [data-claim]').is_enabled()
        assert page.locator('#SR-002 [data-claim]').is_disabled()
        assert page.locator('#pendingCount').inner_text() == "7"
        page.unroute("**/por-identificar-data.js")
        # Una foto ausente no impide identificar la bicicleta por su código.
        page.route("**/images_sreg/1_sreg.jpeg", lambda route: route.abort())
        page.reload()
        page.locator('#SR-001').scroll_into_view_if_needed()
        page.locator('#SR-001 .fallback').wait_for(state="visible")
        assert page.locator('#SR-001 [data-claim]').is_enabled()
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
print("PASS: fotos, búsqueda, ampliación, formulario, WhatsApp, privacidad, móvil, apertura local y lista original.")
print(f"Capturas: {ARTIFACTS}")
