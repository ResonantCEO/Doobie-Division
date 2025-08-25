import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff } from "lucide-react";

interface AuthFormsProps {
  onSuccess?: () => void;
}

export function AuthForms({ onSuccess }: AuthFormsProps = {}) {
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [registerData, setRegisterData] = useState({
    email: "",
    confirmEmail: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    state: "Virginia",
    postalCode: "",
    country: "USA",
  });
  const [idFile, setIdFile] = useState<File | null>(null);
  const [verificationPhoto, setVerificationPhoto] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("login"); // Added state for active tab
  const [signupStep, setSignupStep] = useState(1); // Track signup step (1-4)
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [resetPasswordData, setResetPasswordData] = useState({
    email: "",
    token: "",
    password: "",
    confirmPassword: ""
  });
  const [showResetPassword, setShowResetPassword] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const validatePassword = (password: string) => {
    if (password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/\d/.test(password)) {
      return "Password must contain at least one number";
    }
    return null;
  };

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reset link sent",
        description: "Check your email for password reset instructions.",
      });
      setForgotPasswordEmail("");
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: error.message || "Failed to send reset email.",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { email: string; token: string; password: string }) => {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password reset successful",
        description: "Your password has been updated. You can now sign in.",
      });
      setActiveTab("login");
      setResetPasswordData({ email: "", token: "", password: "", confirmPassword: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Reset failed",
        description: error.message || "Failed to reset password.",
        variant: "destructive",
      });
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome back!", description: "You have been logged in successfully." });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Login failed",
        description: error.message || "Please check your credentials and try again.",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      address: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      idFile: File | null;
      verificationPhoto: File | null;
    }) => {
      const formData = new FormData();
      formData.append("email", data.email);
      formData.append("password", data.password);
      formData.append("firstName", data.firstName);
      formData.append("lastName", data.lastName);
      formData.append("address", data.address);
      formData.append("city", data.city);
      formData.append("state", data.state);
      formData.append("postalCode", data.postalCode);
      formData.append("country", data.country);
      if (data.idFile) {
        formData.append("idImage", data.idFile);
      }
      if (data.verificationPhoto) {
        formData.append("verificationPhoto", data.verificationPhoto);
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      return response.json();
    },
    onSuccess: (response) => {
      // Only auto-login if user session was created (first user)
      if (response.user) {
        toast({
          title: "Registration successful",
          description: response.message,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        onSuccess?.();
      } else {
        // For pending users, show approval notification
        toast({
          title: "Account Approval Required",
          description: "Your registration is complete, but your account must be approved by our team. We appreciate your patience as we process your request.",
          duration: 8000, // Show for 8 seconds since it's important information
        });
        // Switch to login tab and reset signup step
        setActiveTab("login");
        setSignupStep(1);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Registration failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(loginData);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (signupStep === 1) {
      // Validate step 1 fields
      if (registerData.email !== registerData.confirmEmail) {
        toast({
          title: "Email mismatch",
          description: "Email addresses do not match.",
          variant: "destructive",
        });
        return;
      }

      if (registerData.password !== registerData.confirmPassword) {
        toast({
          title: "Password mismatch",
          description: "Passwords do not match.",
          variant: "destructive",
        });
        return;
      }

      const passwordError = validatePassword(registerData.password);
      if (passwordError) {
        toast({
          title: "Invalid password",
          description: passwordError,
          variant: "destructive",
        });
        return;
      }

      setSignupStep(2);
    } else if (signupStep === 2) {
      setSignupStep(3);
    } else if (signupStep === 3) {
      setSignupStep(4);
    } else {
      registerMutation.mutate({ ...registerData, idFile, verificationPhoto });
    }
  };

  const handleForgotPassword = (e: React.FormEvent) => {
    e.preventDefault();
    forgotPasswordMutation.mutate(forgotPasswordEmail);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPasswordData.password !== resetPasswordData.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    resetPasswordMutation.mutate({
      email: resetPasswordData.email,
      token: resetPasswordData.token,
      password: resetPasswordData.password,
    });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Tabs 
        defaultValue="login" 
        className="w-full" 
        value={activeTab} 
        onValueChange={(value) => {
          setActiveTab(value);
          setSignupStep(1); // Reset to step 1 when switching tabs
        }}
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
          <TabsTrigger value="forgot-password" className="text-xs">Reset</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <Card>
            <CardHeader>
              <CardTitle>Welcome back</CardTitle>
              <CardDescription>Sign in to your Doobie Division account</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showLoginPassword ? "text" : "password"}
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                    >
                      {showLoginPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Signing in..." : "Sign In"}
                </Button>
                <div className="text-center mt-4">
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                    onClick={() => setActiveTab("forgot-password")}
                  >
                    Forgot your password?
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>Create account</CardTitle>
              <CardDescription>Join the Doobie Division today</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                {signupStep === 1 ? (
                  <>
                    <div className="text-center mb-4">
                      <p className="text-sm text-muted-foreground">Step 1 of 4 - Basic Information</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          value={registerData.firstName}
                          onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                          id="lastName"
                          value={registerData.lastName}
                          onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registerEmail">Email</Label>
                      <Input
                        id="registerEmail"
                        type="email"
                        value={registerData.email}
                        onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmEmail">Confirm Email</Label>
                      <Input
                        id="confirmEmail"
                        type="email"
                        value={registerData.confirmEmail}
                        onChange={(e) => setRegisterData({ ...registerData, confirmEmail: e.target.value })}
                        required
                        className={registerData.confirmEmail && registerData.email !== registerData.confirmEmail ? "border-red-500" : ""}
                      />
                      {registerData.confirmEmail && registerData.email !== registerData.confirmEmail && (
                        <p className="text-sm text-red-500">Email addresses do not match</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="registerPassword">Password</Label>
                      <div className="relative">
                        <Input
                          id="registerPassword"
                          type={showRegisterPassword ? "text" : "password"}
                          value={registerData.password}
                          onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                          minLength={8}
                          required
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        >
                          {showRegisterPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Password must be at least 8 characters and contain:</p>
                        <ul className="list-disc list-inside space-y-0.5 ml-2">
                          <li className={registerData.password.length >= 8 ? "text-green-600" : ""}>
                            At least 8 characters
                          </li>
                          <li className={/[A-Z]/.test(registerData.password) ? "text-green-600" : ""}>
                            One uppercase letter
                          </li>
                          <li className={/[a-z]/.test(registerData.password) ? "text-green-600" : ""}>
                            One lowercase letter
                          </li>
                          <li className={/\d/.test(registerData.password) ? "text-green-600" : ""}>
                            One number
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showRegisterPassword ? "text" : "password"}
                          value={registerData.confirmPassword}
                          onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                          minLength={8}
                          required
                          className={registerData.confirmPassword && registerData.password !== registerData.confirmPassword ? "border-red-500 pr-10" : "pr-10"}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                        >
                          {showRegisterPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      {registerData.confirmPassword && registerData.password !== registerData.confirmPassword && (
                        <p className="text-sm text-red-500">Passwords do not match</p>
                      )}
                    </div>
                    <Button type="submit" className="w-full">
                      Continue to Address Information
                    </Button>
                  </>
                ) : signupStep === 2 ? (
                  <>
                    <div className="text-center mb-4">
                      <p className="text-sm text-muted-foreground">Step 2 of 4 - Address Information</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Input
                        id="address"
                        value={registerData.address}
                        onChange={(e) => setRegisterData({ ...registerData, address: e.target.value })}
                        placeholder="123 Main Street"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={registerData.city}
                          onChange={(e) => setRegisterData({ ...registerData, city: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">Province/State</Label>
                        <Input
                          id="state"
                          value={registerData.state}
                          onChange={(e) => setRegisterData({ ...registerData, state: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="postalCode">Postal Code</Label>
                        <Input
                          id="postalCode"
                          value={registerData.postalCode}
                          onChange={(e) => setRegisterData({ ...registerData, postalCode: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input
                          id="country"
                          value={registerData.country}
                          onChange={(e) => setRegisterData({ ...registerData, country: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setSignupStep(1)}
                      >
                        Back
                      </Button>
                      <Button type="submit" className="w-full">
                        Continue to Verification
                      </Button>
                    </div>
                  </>
                ) : signupStep === 3 ? (
                  <>
                    <div className="text-center mb-4">
                      <p className="text-sm text-muted-foreground">Step 3 of 4 - Photo ID Verification</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="idUpload">Photo ID</Label>
                      <Input
                        id="idUpload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                        required
                        key="id-upload"
                      />
                      <p className="text-sm text-muted-foreground">Upload a clear photo of your government-issued ID</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setSignupStep(2)}
                      >
                        Back
                      </Button>
                      <Button type="submit" className="w-full">
                        Continue to Verification Photo
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center mb-4">
                      <p className="text-sm text-muted-foreground">Step 4 of 4 - Verification Photo</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="verificationUpload">Verification Photo</Label>
                      <Input
                        id="verificationUpload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setVerificationPhoto(e.target.files?.[0] || null)}
                        required
                        key="verification-upload"
                      />
                      <p className="text-sm text-muted-foreground">
                        Upload a photo of yourself holding a sign that says "Doobie Division!" 
                        Make sure your face and the sign are clearly visible.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setSignupStep(3)}
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? "Creating account..." : "Create Account"}
                      </Button>
                    </div>
                  </>
                )}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forgot-password">
          <Card>
            <CardHeader>
              <CardTitle>Reset Password</CardTitle>
              <CardDescription>Enter your email to receive reset instructions</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">Email</Label>
                  <Input
                    id="forgotEmail"
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={forgotPasswordMutation.isPending}
                >
                  {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                    onClick={() => setActiveTab("login")}
                  >
                    Back to Login
                  </button>
                </div>
              </form>

              {/* Reset Password Form */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-medium mb-4">Have a reset token?</h3>
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail">Email Address</Label>
                    <Input
                      id="resetEmail"
                      type="email"
                      value={resetPasswordData.email}
                      onChange={(e) => setResetPasswordData({ ...resetPasswordData, email: e.target.value })}
                      placeholder="Enter your email address"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resetToken">Reset Token</Label>
                    <Input
                      id="resetToken"
                      type="text"
                      value={resetPasswordData.token}
                      onChange={(e) => setResetPasswordData({ ...resetPasswordData, token: e.target.value })}
                      placeholder="Enter reset token from support"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showResetPassword ? "text" : "password"}
                        value={resetPasswordData.password}
                        onChange={(e) => setResetPasswordData({ ...resetPasswordData, password: e.target.value })}
                        minLength={6}
                        required
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowResetPassword(!showResetPassword)}
                      >
                        {showResetPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type={showResetPassword ? "text" : "password"}
                      value={resetPasswordData.confirmPassword}
                      onChange={(e) => setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })}
                      minLength={6}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={resetPasswordMutation.isPending}
                  >
                    {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}