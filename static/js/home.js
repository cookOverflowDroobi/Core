let imageInput = document.getElementById("image_input");
let videoInput = document.getElementById("video_input");
let imageContainer = document.getElementById("imageContainer");
let videoContainer = document.getElementById("videoContainer");


function previewImage() {
    imageContainer.style.visibility = "visible";
    imageContainer.innerHTML = "";

    for (i of imageInput.files) {
        let reader = new FileReader();
        let figuer = document.createElement("figuer");
        let figCap = document.createElement("figcaption")

        figuer.appendChild(figCap);
        reader.onload = () => {
            let img = document.createElement("img");
            img.setAttribute("src", reader.result);
            figuer.insertBefore(img, figCap);
        }
        imageContainer.appendChild(figuer);
        reader.readAsDataURL(i);
    }
};



function previewVideo() {
    videoContainer.style.visibility = "visible";
    videoContainer.innerHTML = "";

    for (i of videoInput.files) {
        let reader = new FileReader();
        let figuer = document.createElement("figuer");
        let figCap = document.createElement("figcaption");

        figuer.appendChild(figCap);
        reader.onload = () => {
            let vid = document.createElement("video");
            vid.setAttribute("src", reader.result);
            figuer.insertBefore(vid, figCap);
            vid.autoplay = false;
            vid.controls = true;
            vid.style.width = "100%"
        };
        videoContainer.appendChild(figuer);
        reader.readAsDataURL(i);
    }
}

var slideIndex = 1;
showDivs(slideIndex);

function plusDivs(n) {
    showDivs(slideIndex += n);
    return false;
}

function showDivs(n) {
    var i;
    var x = document.getElementsByClassName("mySlides");
    if (n > x.length) { slideIndex = 1 }
    if (n < 1) { slideIndex = x.length };
    for (i = 0; i < x.length; i++) {
        x[i].style.display = "none";
    }
    x[slideIndex - 1].style.display = "block";
}