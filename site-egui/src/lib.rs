//! Web entry point for the egui chess playground.
//!
//! Built for `wasm32-unknown-unknown` and post-processed with `wasm-bindgen
//! --target web`. The `#[wasm_bindgen(start)]` function runs automatically when
//! `index.html` calls the generated `init()`.

mod app;
mod glue;

use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() -> Result<(), JsValue> {
    console_error_panic_hook::set_once();

    use wasm_bindgen::JsCast as _;
    let web_options = eframe::WebOptions::default();

    wasm_bindgen_futures::spawn_local(async {
        let document = web_sys::window()
            .expect("no window")
            .document()
            .expect("no document");
        let canvas = document
            .get_element_by_id("the_canvas_id")
            .expect("missing #the_canvas_id")
            .dyn_into::<web_sys::HtmlCanvasElement>()
            .expect("#the_canvas_id is not a canvas");

        eframe::WebRunner::new()
            .start(
                canvas,
                web_options,
                Box::new(|cc| Ok(Box::new(app::ChessApp::new(cc)))),
            )
            .await
            .expect("failed to start eframe");
    });

    Ok(())
}
