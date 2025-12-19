// Object uploader component for Replit Object Storage
// Reference: blueprint:javascript_object_storage

import { useState, useRef, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import DashboardModal from "@uppy/react/dashboard-modal";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";

// Uppy CSS imports
import "@uppy/core/css/style.css";
import "@uppy/dashboard/css/style.css";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: (file: any) => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
  uploaderId?: string;
}

/**
 * A file upload component that renders as a button and provides a modal interface for
 * file management.
 * 
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - Provides a modal interface for:
 *   - File selection
 *   - File preview
 *   - Upload progress tracking
 *   - Upload status display
 * 
 * The component uses Uppy under the hood to handle all file upload functionality.
 * All file management features are automatically handled by the Uppy dashboard modal.
 * 
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed to be uploaded
 *   (default: 1)
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.onGetUploadParameters - Function to get upload parameters (method and URL).
 *   Typically used to fetch a presigned URL from the backend server for direct-to-S3
 *   uploads.
 * @param props.onComplete - Callback function called when upload is complete. Typically
 *   used to make post-upload API calls to update server state and set object ACL
 *   policies.
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 * @param props.uploaderId - Optional unique identifier for this uploader instance
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  uploaderId,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  
  // Use refs to always have access to the latest callbacks
  const onGetUploadParametersRef = useRef(onGetUploadParameters);
  const onCompleteRef = useRef(onComplete);
  
  // Update refs when callbacks change
  useEffect(() => {
    onGetUploadParametersRef.current = onGetUploadParameters;
  }, [onGetUploadParameters]);
  
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  // Create Uppy instance with stable callbacks that use refs
  const uppy = useMemo(() => {
    const instance = new Uppy({
      id: uploaderId || `uppy-${Math.random().toString(36).substr(2, 9)}`,
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes: ['image/*'],
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: (file: any) => onGetUploadParametersRef.current(file),
      });
    
    return instance;
  }, [uploaderId, maxNumberOfFiles, maxFileSize]);
  
  // Set up complete handler separately to use refs
  useEffect(() => {
    const handleComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
      onCompleteRef.current?.(result);
      setShowModal(false);
    };
    
    uppy.on("complete", handleComplete);
    
    return () => {
      uppy.off("complete", handleComplete);
    };
  }, [uppy]);
  
  // Clean up Uppy instance on unmount
  useEffect(() => {
    return () => {
      uppy.cancelAll();
    };
  }, [uppy]);
  
  // Clear files when modal closes
  const handleCloseModal = () => {
    uppy.cancelAll();
    setShowModal(false);
  };

  return (
    <div>
      <Button 
        type="button"
        onClick={() => setShowModal(true)} 
        className={buttonClassName}
        data-testid="button-upload-photo"
      >
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={handleCloseModal}
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  );
}
