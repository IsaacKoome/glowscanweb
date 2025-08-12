now my vision is to create an app where users can instantly get their face analyzed by an AI and they get a personalized recommendation. You see daily when people wake up they go and look at their faces in the mirror and determine what to do like apply some oil near the nose, or there is too much oil in there forehead so they wipe it out.
Another instance I want to build is for women and makeup. Almost every woman carries a mirror in their handbag afer an hour or 2 they open their bag, get their mirror and apply some makeup, refreshen by adding some i don't know oil on their face etc. What if there was an app that would help them be their mirror and advisor as I think hearing another persons opinion isn't a bad thing. The AI could tell them ,'hey, i think here you have added this and this and this, i think you should reduce it and instead add this other product' etc
Very many people struggle with skin conditions of acne, amongst other such skin conditions i see on Reddit app ,they send there questions saying they have asked tonnes of doctors or they have tried a lot of places without help. We could try to help them as AI is becoming more advanced with thousands of trillions of data having been trained on ,maybe the doctor who tried to find the cure for that persons acne hasn't heard of a doctor from another continent who maybe successfully was able to hep diagonise it, that is where our app can come in and tell them ,'hey you could try this and that recommended from a certain doctor or hospital in Japan' ofcourse taking necessary precautions. The AI can keep daily active progress of the persons acne ,see if maybe after a week or 2 it's improving or not. This is my idea app but so far i have created the app and it isn't so good, i haven't even secured my first paying customer yet but I know I will once i bring this app vision to life.

my though was as , in the chat page, every interaction the user has had with the AI, could         │
│   be stored there so that they open the thread of there previous conversation with the AI and        │
│   see what they had said, also in the "Live analysis" button, the discoverements or what AI          │
│   has seen and recommended, it should be stored in as chats and the user can go and have             │
│   follow up with the AI, the user could say to the AI that you have said my face looks this          │
│   and this ,what should i do to get this? you can see the images in public/images the                │
│   image.png and image3.png how they look like for users being able to see their previous chats       │
│   with the AI. However we could add a certain type of tracker maybe for users to see their           │
│   daily progress with the AI  



  Project Vision: WonderJoy AI

  The primary goal is to create a sophisticated AI-powered application that acts as a personal beauty   
  advisor. Users can perform a "Live Analysis" of their face to receive instant, personalized feedback  
  on their skin health and makeup. The long-term vision includes tracking progress over time and        
  providing evolving recommendations within a continuous, conversational chat interface.

  Key Features & Refinements Implemented:

   1. Conversational Live Analysis:
       * The "Live Analysis" feature, triggered from the main header, now correctly saves the AI's       
         findings into a new chat conversation in Firestore.
       * A bug causing multiple conversations to be created during a single session was fixed by ensuring
         the conversation is created only after a successful analysis is received.
       * The feature was enhanced to be more conversational. A "Live Analysis" button was added directly 
         into the chat view. This allows users to perform subsequent analyses within the same
         conversation, enabling the AI to provide context-aware, follow-up advice.

  Current Unresolved Issues:

   1. Chat UI Layout Bug:
       * Problem: On mobile devices and some larger screens, the chat input form is not visible when the 
         page loads. The user must scroll down to find it, which makes the chat unusable at first glance.
       * Goal: The chat messages area should be scrollable, while the header and the input form remain   
         fixed and always visible.
       * Attempts: Several CSS adjustments using Flexbox and overflow properties on
         app/chat/[conversationId]/page.tsx and components/ChatView.tsx have been attempted, but none    
         have successfully resolved the layout issue.

   2. Analysis Results Not Displaying in Chat:
       * Problem: Although the live analysis results are successfully saved to Firestore as part of a    
         message, they are not being rendered in the chat view. The chat bubble appears, but the detailed
         analysis is missing.
       * Goal: The AnalysisResult component should correctly render the detailed findings within the AI's
         message bubble.
       * Last Attempt: The AIMessage interface in ChatView.tsx was updated to treat analysisData as a    
         generic object (Record<string, unknown>), but this did not fix the rendering problem.