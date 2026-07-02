import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface AccessGateProps {
  onGranted: () => void;
}

export default function AccessGate({ onGranted }: AccessGateProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const verifyMutation = useMutation({
    mutationFn: async (pw: string) => {
      const res = await apiRequest("POST", "/api/access/verify", { password: pw });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/access/status"] });
        onGranted();
      } else {
        toast({ title: "Incorrect password", description: "Please try again.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Incorrect password", description: "Please try again.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      verifyMutation.mutate(password.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-primary/10">
              <Lock className="h-7 w-7 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">Access Required</CardTitle>
          <CardDescription>Enter your access password to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Access password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                autoFocus
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!password.trim() || verifyMutation.isPending}
            >
              {verifyMutation.isPending ? "Verifying..." : "Enter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
