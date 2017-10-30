require.config({
    paths: {
        jquery: "lib/jquery.min",
        sammy: "lib/sammy",
        moment: "lib/moment.min",
        bootstrap: "lib/bootstrap/dist/js/bootstrap.min",
        npm: "lib/npm",
        "bootstrap-editable": "lib/bootstrap-editable-customized.min",
        "bootstrap-slider": "lib/bootstrap-slider.min",
        knockout: "lib/knockout",
        "knockout-amd-helpers": "lib/knockout-amd-helpers",
        "knockout-validation": "lib/knockout.validation.min",
        "knockout-x-editable": "lib/knockout.x-editable.min",
        "knockout-file-bindings": "lib/knockout-file-bindings",
        "socket.io": "lib/socket.io.min",
        text: "lib/text",
        patterns: "extenders/patterns"
    }
});

// Requre jQuery and assign the object to the window since we do not include jQuery on the page.
// Enforce require order for dependant modules.
require( [ "jquery" ], function(jQuery){
    window.jQuery = window.$ = jQuery;

    // Require bootstrap plugins.
    require( [ "npm" ], function(){
        // Require moment for bootstrap-editable.
        require( [ "moment" ], function(){
            // Require the App
            require( [ "app" ], function( App ){
                App.init();
            });
        });
    });
});
