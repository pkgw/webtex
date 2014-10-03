WEBTEX.test_drive = function test_drive (worker_url, data) {
    var master = new Master (worker_url);

    master.handle_render = function handle_render (data) {
	console.log ('render: ' + JSON.stringify (data));
    };

    master.send_message ('parse', data);
};
