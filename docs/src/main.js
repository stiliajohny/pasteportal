const searchParams = new URLSearchParams(window.location.search);
const id = searchParams.get('id');

const pasteportalUrl = 'https://api.pasteportal.info/get-paste?id=';
const pasteportalApiKey = 'qVP1XsKWJF2vud7zo1jzS6BQ22xy4xXH4DY634py';
const headers = {
  "x-api-key": pasteportalApiKey
};
const introParagraph = `
Welcome to Paste Portal!

Are you tired of copying your code from VScode and losing all the syntax highlighting gone?
Now you can directly share from your VSCode and share the link, and the receiver will see the code with the syntax highlighting!
A two steps process to share your code:
1. Select your code
2. Press Ctrl+Alt+Cmd+P, and you get a link to share with your friends!

--

How to use it:

Download the VSCode Extension and use the Command pallet, Sidebar or Shortcut

---

A brief overview of how PastePortal was created (shout out for the prompt @craigmillerdev):

Once upon a time, I was tasked with creating a technical challenge for a job candidate, one that would involve building a service for posting and retrieving messages using their preferred tech stack.
I wanted to see how the candidate would approach the problem and develop a solution. This led to the development of PastePortal.
In addition, you can enhance your experience by downloading the PastePortal VSCode extension, which allows you to access PastePortal directly from your code editor!

https://marketplace.visualstudio.com/items?itemName=JohnStilia.pasteportal

---
`;



// Get the elements
const sidePanel = document.querySelector('.side-panel');
const toggleIcon = document.querySelector('.toggle-icon');
const container = document.querySelector('.container');


// Add event listener to toggle icon
toggleIcon.addEventListener('click', function () {
  sidePanel.classList.toggle('open');
  container.classList.toggle('open');
});




// check if there is an id in the url
if (id) {
  // do fetch request
  getResponse();
} else {
  document.getElementById("text-area").value = introParagraph;

  // append the random joke
  randomJoke().then(joke => {
    document.getElementById("text-area").value += "\n\n" + joke;
  });
}
async function randonLoadingJoke() {
  const messages = [
    "Hang on tight, we're fetching the info like a dog with a chew toy... Woof!",
    "Just a sec, bossing the servers around... Hang tight!",
    "Brewing up some fresh data, almost ready... hold please!",
    "Data dwarves are mining for information, almost there... Brace yourself!",
    "The info is on its way, like a superhero to save the day... Standby!",
    "Retrieving the goods, like a thief in the night... Just a moment!"
  ];

  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

async function randomJoke() {
  try {
    const response = await fetch("https://icanhazdadjoke.com/", {
      headers: {
        "Accept": "application/json"
      }
    });
    const data = await response.json();
    return data.joke;
  } catch (error) {
    return "I'm sorry, I couldn't find a joke for you :(";

  }
}

async function copyToClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true
  } catch (err) {
    return false
  }
}


async function getResponse(id) {
  console.log("getResponse() called");
  id = id || searchParams.get('id');
  try {
    randonLoadingJoke().then(joke => {
      document.getElementById("text-area").value = joke;
    });
    // sleep for 2 seconds
    await new Promise(r => setTimeout(r, 1500));

    const response = await fetch(pasteportalUrl + id, {
      headers
    });
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    const paste = data.response.paste;
    // input the data to the item with id "text-area"
    document.getElementById("text-area").value = paste;
    try {
      copyToClipboard(paste);
      // notificationWindowSuccess("Copied to clipboard");
    } catch (error) {
      // notificationWindowError("Error: " + error);
      console.error("There has been a problem with Clipboard:", error);
    }
    return data;

  } catch (error) {
    // notificationWindowError("Error: " + error);
    console.error("There has been a problem with your fetch operation:", error);
  }
}


var getPasteButton = document.getElementById("getPaste-text");
var hiddenText = document.getElementById("hidden-text");

getPasteButton.addEventListener("click", function () {
  if (hiddenText.style.display === "none") {
    hiddenText.style.display = "block";
  } else {
    hiddenText.style.display = "none";
  }
});

const textArea = document.getElementById("hidden-text").querySelector("textarea");
const pasteIcon = document.querySelector(".get-paste-id-icon");

textArea.addEventListener("input", function () {
  if (textArea.value.length === 6) {
    pasteIcon.classList.add("active");
  } else {
    pasteIcon.classList.remove("active");
  }
});


const getPasteBtn = document.getElementById('id-submit');
const getIdTextArea = document.getElementById('id-textarea');

getPasteBtn.addEventListener('click', () => {
  const id = getIdTextArea.value.trim();
  if (id.length === 6) {
    getResponse(id);
  }
});