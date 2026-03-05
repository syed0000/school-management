"use client"

import { useState, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Upload, AlertCircle, CheckCircle } from "lucide-react"
import * as XLSX from "xlsx"
import { bulkImportStudents } from "@/actions/import"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function StudentImport() {
  const [data, setData] = useState<Record<string, unknown>[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failureCount: number;
    errors: string[];
  } | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [confirmationRequired, setConfirmationRequired] = useState(false)
  const [fileFormat, setFileFormat] = useState("xlsx")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const requiredFields = [
    { name: "Student Name", key: "Student Name" },
    { name: "Father Name", key: "Father Name" },
    { name: "Class Name", key: "Class Name" },
  ]
  
  const optionalFields = [
    { name: "Registration Number", key: "Registration Number" },
    { name: "Section", key: "Section" },
    { name: "Roll Number", key: "Roll Number" },
    { name: "Mother Name", key: "Mother Name" },
    { name: "Father Aadhaar", key: "Father Aadhaar" },
    { name: "Mother Aadhaar", key: "Mother Aadhaar" },
    { name: "Gender", key: "Gender" },
    { name: "Date of Birth", key: "Date of Birth" },
    { name: "Address", key: "Address" },
    { name: "Contact Number", key: "Contact Number" },
    { name: "Email", key: "Email" },
    { name: "Admission Date", key: "Admission Date" },
    { name: "PEN", key: "PEN" },
    { name: "Last Institution", key: "Last Institution" },
    { name: "TC Number", key: "TC Number" },
  ]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setValidationError(null)
      setImportResult(null)
      parseFile(selectedFile)
    }
  }

  const validateData = (jsonData: Record<string, unknown>[]) => {
    if (jsonData.length === 0) return;
    
    // Normalize keys to lowercase for checking
    const headers = Object.keys(jsonData[0]);
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());
    const missing: string[] = [];

    // Helper to check for variations
    const hasField = (variations: string[]) => {
        return variations.some(v => lowerHeaders.includes(v.toLowerCase()));
    };

    // Check for "Student Name" variations
    if (!hasField(["Student Name", "Name", "StudentName"])) {
        missing.push("Student Name");
    }
    // Check for "Father Name" variations
    if (!hasField(["Father Name", "Father's Name", "FatherName"])) {
        missing.push("Father Name");
    }
    // Check for "Class Name" variations
    if (!hasField(["Class Name", "Class", "ClassName"])) {
        missing.push("Class");
    }

    if (missing.length > 0) {
        setValidationError(`Missing required columns: ${missing.join(", ")}`);
    } else {
        setValidationError(null);
    }
  }

  const parseFile = (file: File) => {
    setIsLoading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result
        let jsonData: Record<string, unknown>[] = [];
        
        if (fileFormat === "json") {
             const json = JSON.parse(bstr as string);
             jsonData = Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
        } else {
             const wb = XLSX.read(bstr, { type: 'binary' })
             wb.SheetNames.forEach(sheetName => {
                 const ws = wb.Sheets[sheetName];
                 const sheetData = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, unknown>[];
                 jsonData = [...jsonData, ...sheetData];
             });
        }
        
        setData(jsonData)
        validateData(jsonData)
        setConfirmationRequired(false)
        
      } catch (error) {
        toast.error("Failed to parse file")
        console.error(error)
      } finally {
        setIsLoading(false)
      }
    }
    
    if (fileFormat === "json") {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file)
    }
  }

  const handleReview = async () => {
      if (data.length === 0) {
        toast.error("No data to import")
        return
      }
      
      setIsUploading(true);
      try {
        const plainData = JSON.parse(JSON.stringify(data));
        const result = await bulkImportStudents(plainData, false); // dry run
        
        if (result.success && 'successCount' in result) {
             setImportResult({
                successCount: result.successCount,
                failureCount: result.failureCount,
                errors: result.errors
            });
            setConfirmationRequired(true);
        } else {
             toast.error(result.error || "Review failed");
        }
      } catch {
         toast.error("Failed to review data");
      } finally {
         setIsUploading(false);
      }
  }

  const handleImport = async () => {
    if (data.length === 0) {
      toast.error("No data to import")
      return
    }

    setIsUploading(true)
    try {
      // Ensure data contains only plain objects by deep cloning
      const plainData = JSON.parse(JSON.stringify(data));

      const result = await bulkImportStudents(plainData, true) // Actual import

      if (result.success && 'successCount' in result) {
        setImportResult({
          successCount: result.successCount,
          failureCount: result.failureCount,
          errors: result.errors
        })
        if (result.successCount > 0) {
            toast.success(`Successfully imported ${result.successCount} students`)
            // Clear file input on success
            setData([]);
            setConfirmationRequired(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
        if (result.failureCount > 0) {
            toast.warning(`Failed to import ${result.failureCount} rows`)
        }
      } else {
        toast.error(result.error || "Import failed")
      }
    } catch {
      toast.error("Import failed")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bulk Import Students</CardTitle>
          <CardDescription>Select your file format and upload data. Please ensure your file follows the structure below.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* File Format Selection */}
          <div className="flex flex-col md:flex-row gap-4">
             <div className="w-full md:w-1/3 space-y-2">
                 <label className="text-sm font-medium">File Format</label>
                 <Select value={fileFormat} onValueChange={setFileFormat}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select Format" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="xlsx">Excel (.xlsx, .xls)</SelectItem>
                        <SelectItem value="csv">CSV (.csv)</SelectItem>
                        <SelectItem value="json">JSON (.json)</SelectItem>
                    </SelectContent>
                 </Select>
             </div>
             
             <div className="w-full md:w-2/3 space-y-2">
                 <label className="text-sm font-medium">Upload File</label>
                 <Input 
                  ref={fileInputRef}
                  type="file" 
                  accept={fileFormat === 'json' ? ".json" : ".csv, .xlsx, .xls"}
                  onChange={handleFileChange}
                  className="cursor-pointer file:cursor-pointer"
                />
             </div>
          </div>

          {/* Structure Guide */}
          <div className="bg-muted p-4 rounded-md text-sm space-y-2">
              <h4 className="font-semibold">Required Columns/Keys:</h4>
              <div className="flex flex-wrap gap-2">
                  {requiredFields.map(f => (
                      <span key={f.key} className="px-2 py-1 bg-primary/10 text-primary rounded-md border border-primary/20">
                          {f.name}
                      </span>
                  ))}
              </div>
              <h4 className="font-semibold pt-2">Optional Columns/Keys:</h4>
               <div className="flex flex-wrap gap-2">
                  {optionalFields.map(f => (
                      <span key={f.key} className="px-2 py-1 bg-muted-foreground/10 text-muted-foreground rounded-md border">
                          {f.name}
                      </span>
                  ))}
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                  * If Registration Number is omitted, it will be left blank.
                  <br/>
                  * Missing optional fields will be left blank. Admission Date defaults to today if missing.
              </p>
          </div>

          {isLoading && (
             <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2">Parsing file...</span>
             </div>
          )}

          {data.length > 0 && !isLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                 <h3 className="font-semibold text-lg">Preview ({data.length} rows)</h3>
                 
                 {!confirmationRequired ? (
                    <Button onClick={handleReview} disabled={isUploading || !!validationError} variant={validationError ? "destructive" : "default"}>
                       {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                       Review Data
                    </Button>
                 ) : (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setConfirmationRequired(false)} disabled={isUploading}>
                            Cancel
                        </Button>
                        <Button onClick={handleImport} disabled={isUploading} variant="default">
                            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                            Confirm Import
                        </Button>
                    </div>
                 )}
              </div>

              {confirmationRequired && !isUploading && (
                  <Alert className={importResult?.failureCount ? "bg-red-50 border-red-200" : "bg-blue-50 border-blue-200"}>
                      <AlertCircle className={`h-4 w-4 ${importResult?.failureCount ? "text-red-600" : "text-blue-600"}`} />
                      <AlertTitle className={importResult?.failureCount ? "text-red-800" : "text-blue-800"}>
                          {importResult?.failureCount ? "Data Issues Found" : "Ready to Import"}
                      </AlertTitle>
                      <AlertDescription className={importResult?.failureCount ? "text-red-700" : "text-blue-700"}>
                          {importResult?.failureCount ? (
                              <span>
                                  <strong>{importResult.failureCount}</strong> rows have errors and will be skipped.
                                  <strong> {importResult.successCount}</strong> rows are valid.
                                  Do you want to proceed with importing only the valid rows?
                              </span>
                          ) : (
                              <span>
                                  All <strong>{importResult?.successCount}</strong> rows look good. Ready to import.
                              </span>
                          )}
                      </AlertDescription>
                  </Alert>
              )}

              {validationError && (
                  <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Invalid File Format</AlertTitle>
                      <AlertDescription>
                          {validationError}. Please fix the column headers and try again.
                      </AlertDescription>
                  </Alert>
              )}
              
              <div className="border rounded-md max-h-[400px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(data[0] || {}).map((header) => (
                        <TableHead key={header}>{header}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {Object.values(row).map((cell: unknown, j) => (
                          <TableCell key={j}>{String(cell)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {data.length > 5 && (
                    <div className="p-4 text-center text-sm text-muted-foreground border-t">
                        ...and {data.length - 5} more rows
                    </div>
                )}
              </div>
            </div>
          )}

          {importResult && (
            <div className="space-y-4 pt-4 border-t">
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-md border border-green-200">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Success: {importResult.successCount}</span>
                  </div>
                  <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-md border border-red-200">
                      <AlertCircle className="h-5 w-5" />
                      <span className="font-medium">Failed: {importResult.failureCount}</span>
                  </div>
               </div>
               
               {importResult.errors.length > 0 && (
                   <Alert variant="destructive">
                       <AlertCircle className="h-4 w-4" />
                       <AlertTitle>Error Details</AlertTitle>
                       <AlertDescription>
                           <ul className="list-disc pl-4 mt-2 max-h-[200px] overflow-auto text-xs space-y-1">
                               {importResult.errors.map((err, i) => (
                                   <li key={i}>{err}</li>
                               ))}
                           </ul>
                       </AlertDescription>
                   </Alert>
               )}
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
