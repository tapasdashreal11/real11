self.addEventListener("push", function(e) {
    const data = e.data.json();
    var title = data.title;
    var message = data.message;
    var icon = data.icon;
    var dataurl = {
        url: data.url
    };

    self.registration.showNotification(title || 'Notification', {
        body: message,
        icon: icon || '/images/favicon.ico',
        data: dataurl
    });
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    var url = event.notification.data.url;
    event.waitUntil(
        clients.matchAll({
            type: "window"
        })
        .then(function(clientList) {
            for (var i = 0; i < clientList.length; i++) {
                var client = clientList[i];
                if (client.url == '/' && 'focus' in client)
                    return client.focus();
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});