// User PROXY or SETTER & GETTER
// ------------------------------------------------------------------------------------------

// manage state for running acitons after logging
var load = {
    menu: false,
    order: false,
    handler: ()=>{ return true }
}

const load_handler = {
    set(obj, prop, value) {
        Reflect.set(...arguments);
        if(Reflect.get(obj, 'menu') && Reflect.get(obj, 'order')) {
            Reflect.get(obj, 'handler')()
        }
        return true;
    }
  };

// Manage state for checkout button
var checkout_load = {
    get_orders: false,
    render_checkout: true,
    add_items: true,
    close_order: true,
    handler_load: ()=>{ return true },
    handler_checkout: ()=>{ return true }
}

const checkout_handler = {
    set(obj, prop, value) {
        Reflect.set(...arguments);
        if(!Reflect.get(obj, 'render_checkout') || !Reflect.get(obj, 'get_orders') || !Reflect.get(obj, 'add_items') || !Reflect.get(obj, 'close_order')) {
            Reflect.get(obj, 'handler_load')()
        }else{
            Reflect.get(obj, 'handler_checkout')()
        }
        return true;
    }
};

// EXPORT=================================================  
// 
window.__venue_hours = [];
window.__load = new Proxy(load, load_handler);
window.__checkout_load = new Proxy(checkout_load, checkout_handler);
window.__all_orders_information = []
// ------------------------------------------------------------------------------------------