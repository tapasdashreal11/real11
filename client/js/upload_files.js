var cropper = {};
var container_width;
var container_height;
var modal_margin_left;
var list_of_uploaded_images = [];
var cancelledAmount = 0;
var filesAmount = 0;

window.$amazon = {
    input: '#amazon-upload-images',
    multiple: true,
    frame: 16/9,
    type : '',
    urls: [],
    callback: {}
}

$(document).ready(function(){
    // initial processing
    get_size_container();
    init_upload_modal();

    // upload restaurant images
    $('#amazon-upload-images').on('click', function() {
        if(!window.$amazon.multiple) $('#amazon-upload-images').removeAttr('multiple');
    });
    $('#amazon-upload-images').on('change', function() {
        cropper = {};
        list_of_uploaded_images = [];
        cancelledAmount = 0;
        filesAmount = 0;
        if(!window.$amazon.multiple) $('#amazon-upload-images').removeAttr('multiple');
        upload_images(this);
    });
    $('#modal-upload-images').on('click','.submit-image',function(){
        $(this).prop('disabled', true);
        $(this).text('Uploading...');
        let key = $(this).data('key');
        upload_images_to_amazons3(key).then((success)=>{
            window.$amazon.callback[$amazon.type]();
        });
        
    })
    $('#modal-upload-images').on('click','.cancel-image',function(){
        let key = $(this).data('key');
        $(`#image-${key}`).remove();
        cancelledAmount ++;
        $('#number-of-cancelled-images').text(`Cancelled: ${cancelledAmount}/${filesAmount}`);
        upload_compeltely();        
    })
})

// ------------------------------------------------------------

var upload_images_to_amazons3 = function(key){
    return new Promise((resolve, reject)=>{
        let image_data = cropper[key].getCroppedCanvas().toDataURL('image/jpeg');
        let data = {
            images: [image_data]
        }
        $.ajax({
            url: '/upload-images-to-amazons3',
            method: 'POST',
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            data: JSON.stringify(data),
        })
        .then((res)=> {
            window.$amazon.urls = res.data;
            list_of_uploaded_images = list_of_uploaded_images.concat(res.data);
            $('#number-of-uploaded-images').text(`Uploaded: ${list_of_uploaded_images.length}/${filesAmount}`);
            let html = `
                <img src="${image_data}" style="width: 100px !important; display:inline-block;margin-left: 10%">
                <p class="h4" style="display:inline-block; color: green;"><i class="fa fa-check fa-2x" aria-hidden="true"></i></p>
            `;
            $(`#image-${key}`).html(html);
            upload_compeltely()
            return resolve(res.data)
        })
        .catch((error)=>{
            return reject(error)
        })
    })
}

function upload_compeltely(){
    let total_images = Number(list_of_uploaded_images.length) + Number(cancelledAmount);
    if(total_images != Number(filesAmount)) return false;
    setTimeout(function(){
        $('#modal-upload-images').fadeOut();
        $('#list-of-uploaded-images').html('');
        $('#number-of-uploaded-images').text('');
        $('#number-of-cancelled-images').text('');
        if(toastr) toastr.success('Upload completely');
    }, 1000)
}

function get_size_container(){
    let screen_width = screen.width;
    if(screen_width < 500){
        container_width = screen_width * 0.8;
        modal_margin_left = 10;
    }else{
        container_width = screen_width * 0.5;
        modal_margin_left = 20;
    }  
    container_height =   container_width * 9 / 16;
}

function init_upload_modal(){
    let html = `
        <div class="row col-xs-12 col-sm-12 col-md-12" style="display: none;">
            <input type="file" id="amazon-upload-images" ${window.$amazon.multiple ? 'multiple' : ''}>
        </div>
        <div id="modal-upload-images" style="position: fixed; display: none; width: 100%; height: 100%; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.5); z-index: 9999;cursor: pointer;overflow-y: auto;">
            <div 
                style="
                        background-color: white;
                        margin-top: 5%; 
                        margin-left: ${modal_margin_left}%; 
                        margin-bottom: 5%; 
                        width: ${100-modal_margin_left*2}%; 
                        padding: 10px;
                        border-radius: 25px;
                        box-shadow: 0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22);
                    "
                class="center-block">
                <div class="form-row form-group">
                    <p class="h3" id="number-of-uploaded-images" style="font-weight: bold; color: green ;display: inline-block; margin-top: 35px; margin-left: 20px;"></p>
                    <p class="h3" id="number-of-cancelled-images" style="font-weight: bold; color: red ;display: inline-block; margin-top: 35px; margin-left: 20px;"></p>
                    <p class="h3 float-right" id="close-upload-modal" style="margin-right: 5%; color: red; display: inline-block"><i class="fa fa-times fa-2x" aria-hidden="true"></i></p>
                </div>
                <div id="list-of-uploaded-images">

                </div>
            </div>
        </div>
    `;
    $('body').append(html);
    $('#close-upload-modal').on('click',function(){
        swal({
            title: "Are you sure to cancel to upload all images?",
            html: true,
            text: `This action only cancel the images that aren't uploaded.`,
            type: "warning",
            showCancelButton: true,
            confirmButtonText: "Ok",
            confirmButtonColor: "#3cb371",
            cancelButtonText: "No",
            closeOnCancel: true
        }, function (result) {
            if (result) {
                $('#list-of-uploaded-images').html('');
                $('#number-of-uploaded-images').text('');
                $('#number-of-cancelled-images').text('');
                $('#modal-upload-images').hide();   
            }
        });
    })
}

var upload_images = function(input) {
    if (!input.files) return false;
    filesAmount = input.files.length;
    for (var i = 0; i < filesAmount; i++) {
            let reader = new FileReader();
            reader.onload = function() {

                let canvas = document.createElement("canvas");
                let context = canvas.getContext('2d');
                let img = new Image();
    
                img.onload = function() {
                    if(img.width < img.height){
                        canvas.width = 480;
                        canvas.height = 720;
                    }else{
                        canvas.width = 720;
                        canvas.height = 480;
                    }
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    context.drawImage(img, 0, 0, canvas.width, canvas.height);
                    let base_img = canvas.toDataURL('image/jpeg', 1);
                    let key = Math.random().toString(36).substring(2);
                    let html = `
                            <div class="form-row" id="image-${key}" style="padding-top: 20px; padding-bottom: 20px;border-top: 5px solid grey;">
                                <div class="form-row col-xs-12 col-sm-12 col-md-12">
                                    <div style="width: ${container_width}px; height: ${container_height}px; margin: auto;" >
                                        <img id="upload-image-${key}" style="width: 100%;" src="${base_img}">
                                    <div>
                                </div>
                                <div class="form-row col-xs-12 col-sm-12 col-md-12" style="padding-top: 20px">
                                    <div class="col-xs-6 col-sm-6 col-md-6">
                                        <button type="button" class="btn btn-danger cancel-image" data-key="${key}" style="display: inline-block">Cancel</button>
                                    </div>
                                    <div class="col-xs-6 col-sm-6 col-md-6">
                                        <button type="button" class="btn btn-success float-right submit-image" data-key="${key}" style="display: inline-block">Submit</button>
                                    </div>
                                </div>
                            </div>
                    `;
                    $('#list-of-uploaded-images').append(html);
                    let photo = $('#list-of-uploaded-images').find(`#upload-image-${key}`);
                    crop_photo(photo, key);
                }
                img.src = reader.result;
            }
            reader.readAsDataURL(input.files[i]);
    }
    $('#modal-upload-images').fadeIn();
};

const crop_photo = function(image, key){
    image.cropper({
        aspectRatio: window.$amazon.frame || 16/9,
        minContainerWidth: container_width,
        minContainerHeight: container_height,
        background: false,
        crop: function(event) {
            // console.log(event);
        },
    });
    cropper[key] = image.data('cropper');
}
