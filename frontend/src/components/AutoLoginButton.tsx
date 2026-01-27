import { useSignIn } from "@clerk/clerk-react";
import { Button, keyframes } from '@mui/material';
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export const AutoLoginButton = ({disablePulse=false}) => {
  const { signIn, setActive, isLoaded } = useSignIn();
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const handleGuestLogin = async () => {
    if (!isLoaded) return;
    setIsLoading(true);

    try {
      // STEP 1: Start the Login Process (Identify the user)
      const signInAttempt = await signIn.create({
        identifier: "demo@mail.com",
      });

      // STEP 2: Check if it needs a password (It usually does)
      if (signInAttempt.status === "needs_first_factor") {
        
        // STEP 3: Send the Password automatically
        const completeSignIn = await signInAttempt.attemptFirstFactor({
          strategy: "password",
          password: "dem@123!", // The password you set in Dashboard
        });
        // STEP 4: Activate the Session
        if (completeSignIn.status === "complete") {
        await setActive({ session: completeSignIn.createdSessionId });
        navigate("/");
        } else {
        console.error("Login stuck:", completeSignIn);
        }
      } 
      
    } catch (err: any) {
      console.error("Guest login failed:", err.errors ? err.errors[0].message : err);
      alert("Demo Login Failed: " + (err.errors ? err.errors[0].longMessage : "Unknown Error"));
    } finally {
      setIsLoading(false);
    }
  };
  const pulse = keyframes`
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.02); opacity: 0.8; color: #cfe5f1; }
    100% { transform: scale(1); opacity: 1; }
    `;

  return (
    <Button
        onClick={handleGuestLogin}
        disabled={isLoading}
        variant={disablePulse ? "contained" : "text"}
        sx={{
        px: 4, py: 1.5, fontWeight: 600, 
        color: 'white',
        // Apply the animation: 2 seconds, ease-in-out timing, infinite loop
        animation: (!isLoading && !disablePulse) ? `${pulse} 1.5s ease-in-out infinite` : 'none',
        '&:hover': {
          animation: 'none', // Optional: stop flashing when user hovers
        },
      }}
    >
      {isLoading ? (
        <span>Logging in...</span> 
      ) : (
        <>
          <span>TRY DEMO</span>
        </>
      )}
    </Button>
  );
};