$(function () {
  if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/js/service-worker.js')
      .then((initialiseState))
      .catch(function(e) {
        console.log(e);
      })
  } else {
      // alert('Service workers aren\'t supported in this browser.');
      console.log("Service workers aren't supported in this browser.");
  }
  const publicVapidKey = 'BNSrScg_E1hM7rhwlD-CJJT-VzDMhy3f4Y29VUSyitR8L2usjlBJIJwne_Bu4NhiuC9nhYHQ4JHUXnRnOrTUk2A';

  function initialiseState(register) {
    if (!('showNotification' in ServiceWorkerRegistration.prototype)) {
        console.log('Notifications aren\'t supported.');
        return;
    }

    if (Notification.permission === 'denied') {
        console.log('The user has blocked notifications.');
        return;
    }

    if (!('PushManager' in window)) {
        console.log('Push messaging isn\'t supported.');
        return;
    }

    if($("#account-id").val()) {
      console.log("#account-id");
      register.pushManager.getSubscription()
      .then(function(subscription) {
        console.log(subscription);

          if (!subscription) {
            getPublicVapidKey(register);
          } else {
            sendSubscriptionToServer(subscription);
          }

      })
      .catch(function(err) {
          console.warn('Error during getSubscription()', err);
      });
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function subscribe(register, vapidkey) {
    register.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidkey || publicVapidKey)
    }).then(function(subscription) {
        console.log("subscribe");
        console.log(subscription);
        return sendSubscriptionToServer(subscription);
    })
    .catch(function(e) {
      console.log(e);
    });
  }

  function sendSubscriptionToServer(subscription) {
    $.ajax({
      url : "/registerDevice",
      method: 'POST',
      contentType: "application/json; charset=utf-8",
      data: JSON.stringify({
        device_type : 'web-browser',
        deviceData  : subscription
      }),
      dataType: 'json',
    })
  }

  function getPublicVapidKey(register) {
    $.ajax({
      url : "/notification/getVapidpublickey",
      method: 'GET',
      contentType: "application/json; charset=utf-8",
      dataType: 'json',
    }).then((res) => {
      console.log("getPublicVapidKey");
      console.log(res);
      if(res.publicVapidKey) subscribe(register, res.publicVapidKey);
    })
  }
})
