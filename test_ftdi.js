try {
    require('./node_modules/ftdi-d2xx/build/Release/ftdi-d2xx.Linux.x86_64.node');
    console.log("Success");
} catch (e) {
    console.error("Error loading module:", e);
}
