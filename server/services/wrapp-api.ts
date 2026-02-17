interface WrappLoginResponse {
  data: {
    type: string;
    attributes: {
      jwt: string;
    };
  };
}

/**
 * Customer information for invoice counterpart
 */
export interface CustomerInfo {
  /** Customer name */
  name: string;
  /** Customer email */
  email: string;
  /** Country code (e.g., "GR") */
  countryCode?: string;
  /** VAT number (optional) */
  vat?: string;
  /** City (optional) */
  city?: string;
  /** Street address (optional) */
  street?: string;
  /** Street number (optional) */
  number?: string;
  /** Postal code (optional) */
  postalCode?: string;
}

/**
 * Input parameters for creating an invoice
 */
export interface CreateInvoiceInput {
  /** Amount in cents (integer) from DB */
  amount: number;
  /** Currency code, typically "EUR" */
  currency: string;
  /** Invoice description */
  description: string;
  /** Product/service name */
  title: string;
  /** Customer information (required) */
  customer: CustomerInfo;
  /** Invoice type: "invoice" or "receipt" */
  invoiceType?: string;
  /** Classification type code (e.g., "E3_561_001") */
  classificationType?: string;
  /** Invoice type code (e.g., "2.1") */
  invoiceTypeCode?: string;
  /** Product name */
  productName?: string;
}

/**
 * Response structure from Wrapp API invoice creation
 */
export interface WrappInvoiceResponse {
  /** Whether the invoice creation was successful */
  success: boolean;
  /** Invoice ID from Wrapp API */
  invoiceId: string;
  /** Invoice number (if available) */
  invoiceNumber?: string;
  /** PDF URL (if available) */
  pdfUrl?: string;
  /** Invoice mark (if available) */
  mark?: string;
  /** Full raw response for debugging */
  rawResponse: any;
}

class WrappApiService {
  private email: string;
  private apiKey: string;
  private baseUrl: string;
  private jwtToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    const isProduction = process.env.NODE_ENV === 'production';
    
    this.email = isProduction 
      ? process.env.WRAPP_PROD_EMAIL! 
      : process.env.WRAPP_STAGING_EMAIL!;
    
    this.apiKey = isProduction 
      ? process.env.WRAPP_PROD_API_KEY! 
      : process.env.WRAPP_STAGING_API_KEY!;
    
    this.baseUrl = isProduction 
      ? process.env.WRAPP_PROD_BASE_URL!
      : process.env.WRAPP_STAGING_BASE_URL!;
    
    console.log(`[Wrapp API] Initialized in ${isProduction ? 'PRODUCTION' : 'STAGING'} mode`);
  }

  private async getValidToken(): Promise<string> {
    if (this.jwtToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.jwtToken;
    }
    return await this.login();
  }

  private async login(): Promise<string> {
    const loginUrl = `${this.baseUrl}/login`;

      console.log('[Wrapp API] ===================== CREDENTIAL DEBUG ===');
      console.log('NODE ENV -> ', process.env.NODE_ENV);
      console.log('BASE URL -> ', this.baseUrl);
      console.log('API KEY -> ', this.apiKey);
      console.log('EMAIL -> ', this.email);
      console.log('[Wrapp API] ====================== END CREDENTIAL DEBUG ===');
      

    // Validate credentials are set
    if (!this.email || !this.apiKey) {
      const errorMsg = 'Wrapp API credentials not configured. Please set WRAPP_PROD_EMAIL and WRAPP_PROD_API_KEY environment variables.';
      console.error('[Wrapp API]', errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const requestBody = {
        email: this.email,
        api_key: this.apiKey
      };
      
      console.log('[Wrapp API] Logging in...', {
        email: this.email,
        baseUrl: this.baseUrl,
        apiKeyLength: this.apiKey?.length,
        apiKeyPreview: this.apiKey ? `${this.apiKey.substring(0, 4)}...${this.apiKey.substring(this.apiKey.length - 4)}` : 'missing'
      });
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const responseData = await response.json() as WrappLoginResponse;

      // Check for error status
      if (!response.ok) {
        const errorData = responseData as any;
        const errorMsg = errorData?.errors?.[0]?.title 
          || errorData?.message 
          || errorData?.error 
          || `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      if (responseData && responseData.data) {
        this.jwtToken = responseData.data.attributes.jwt;
        this.tokenExpiry = new Date(Date.now() + 23 * 60 * 60 * 1000); // 23 hours
        
        console.log('[Wrapp API] Login successful, token valid until:', this.tokenExpiry);
        return this.jwtToken;
      }

      throw new Error('Failed to login to Wrapp API - invalid response format');

    } catch (error: any) {
      const errorMessage = error.message;
      
      console.error('[Wrapp API] Login error:', {
        message: errorMessage,
        email: this.email,
        baseUrl: this.baseUrl,
        apiKeyLength: this.apiKey?.length
      });
      
      // Provide helpful error message
      let finalErrorMessage = `Wrapp API login failed: ${errorMessage}`;
      
      if (errorMessage?.toLowerCase().includes('not valid user')) {
        finalErrorMessage += '\n\nPossible issues:\n' +
          '1. Verify the API credentials are correct and active\n' +
          '2. Check if the account has API access enabled\n' +
          '3. Confirm you are using the correct environment (staging vs production)\n' +
          '4. Contact Wrapp support to verify API access for this account';
      }
      
      throw new Error(finalErrorMessage);
    }
  }

  async makeAuthenticatedRequest<T = any>(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', 
    data: any = null
  ): Promise<T> {
    const token = await this.getValidToken();
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: data ? JSON.stringify(data) : undefined
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorDetails = responseData?.errors 
          ? responseData.errors.map((e: any) => e.title || e.message || JSON.stringify(e)).join('; ')
          : responseData?.message || responseData?.error || `HTTP ${response.status}`;
        
        console.error('[Wrapp API] Request error:', {
          endpoint,
          method,
          status: response.status,
          error: errorDetails,
          fullErrorData: JSON.stringify(responseData, null, 2)
        });
        
        const error: any = new Error(errorDetails);
        error.response = { status: response.status, data: responseData };
        throw error;
      }

      return responseData as T;

    } catch (error: any) {
      if (!error.response) {
        console.error('[Wrapp API] Request error:', {
          endpoint,
          method,
          error: error.message
        });
      }
      throw error;
    }
  }

  /**
   * Creates an invoice using the Wrapp.ai API
   * 
   * @param input - Invoice creation parameters
   * @returns Promise resolving to invoice response data
   */
  async createInvoice(input: CreateInvoiceInput): Promise<any> {
    try {
      // Calculate amounts (0% VAT rate)
      const totalAmount = Number((input.amount / 100).toFixed(2));  // Convert cents to euros
      const netAmount = totalAmount;  // No VAT, net equals total
      const vatAmount = 0;  // 0% VAT rate

      console.log('[Wrapp] Creating invoice:', { amount: totalAmount, net: netAmount, vat: vatAmount });

      // Use provided values or determine invoice_type_code and classification_type based on invoiceType
      const invoiceTypeCode = input.invoiceTypeCode || "";
      const classificationType = input.classificationType || "";

      // Fetch billing books to get the correct billing_book_id
      const billingBooksResponse = await this.makeAuthenticatedRequest(
        '/billing_books',
        'GET'
      );

      console.log('[Wrapp] Billing books response:', billingBooksResponse);

      const billingBooks = Array.isArray(billingBooksResponse) 
        ? billingBooksResponse 
        : (Array.isArray(billingBooksResponse?.data) 
          ? billingBooksResponse.data 
          : (billingBooksResponse?.data?.data || []));
      
      const billingBook = billingBooks.find((book: any) => book.invoice_type_code === invoiceTypeCode);

      if (!billingBook) {
        throw new Error(`Billing book not found for invoice_type_code: ${invoiceTypeCode}`);
      }

      console.log('[Wrapp] Selected billing book:', {
        id: billingBook.id,
        name: billingBook.name,
        invoice_type_code: billingBook.invoice_type_code
      });

      // Build EXACT request body (the one that worked in Postman)
      const requestBody = {
        billing_book_id: billingBook.id,
        invoice_type_code: invoiceTypeCode,
        payment_method_type: 6,
        currency: 'EUR',
        net_total_amount: netAmount,
        vat_total_amount: vatAmount,
        total_amount: totalAmount,
        payable_total_amount: totalAmount,
        counterpart: {
          name: input.customer.name,
          country_code: input.customer.countryCode || "GR",
          vat: input.customer.vat || "",
          city: input.customer.city || "",
          street: input.customer.street || "",
          number: input.customer.number || "",
          postal_code: input.customer.postalCode || "",
          email: input.customer.email
        },
        invoice_lines: [
          {
            line_number: 1,
            name: input.productName || input.title,
            description: '',
            quantity: 1,
            quantity_type: 1,
            unit_price: netAmount,
            net_total_price: netAmount,
            vat_rate: 0, // Change this to 24 when time comes
            vat_exemption_code: 15,
            vat_total: vatAmount,
            subtotal: netAmount,
            classification_category: "category1_3",
            classification_type: classificationType
          }
        ],
        generate_pdf: false,
        draft: false,
        email_locale: "el"
      };

      console.log('[Wrapp] Request body:', requestBody);

      // Make API call
      const response = await this.makeAuthenticatedRequest(
        '/invoices',
        'POST',
        requestBody
      );

      console.log('[Wrapp] Response:', response);

      return response;

    } catch (error: any) {
      const errorData = error.response?.data;
      const errorStatus = errorData?.status;
      const errorMessages = errorData?.errors 
        ? errorData.errors.map((e: any) => e.title || e.message || JSON.stringify(e))
        : [];
      
      const errorDetails = errorMessages.length > 0
        ? errorMessages.join('; ')
        : errorData?.message || errorData?.error || error.message || 'Unknown error occurred';

      console.error('[Wrapp API] Invoice creation error:', {
        message: error.message,
        status: error.response?.status,
        errorStatus: errorStatus,
        errors: errorMessages,
        errorDetails: errorDetails,
        fullErrorData: JSON.stringify(errorData, null, 2)
      });

      const errorMessage = errorStatus === 'Invoice Errors' && errorMessages.length > 0
        ? `${errorStatus}: ${errorDetails}`
        : errorStatus === 'myDATA Errors' && errorMessages.length > 0
        ? `${errorStatus}: ${errorDetails}`
        : errorDetails;

      throw new Error(`Wrapp API invoice creation failed: ${errorMessage}`);
    }
  }

  /**
   * Generates a PDF for a specific invoice using the Wrapp.ai API
   * 
   * @param invoiceId - The ID of the invoice to generate PDF for
   * @param locale - Optional locale ('el' or 'en'), defaults to 'el'
   * @returns Promise resolving to the PDF generation response
   */
  async generateInvoicePdf(invoiceId: string, locale: 'el' | 'en' = 'el'): Promise<any> {
    try {
      if (!invoiceId) {
        throw new Error('Invoice ID is required');
      }

      const endpoint = `/invoices/${invoiceId}/generate_pdf${locale ? `?locale=${locale}` : ''}`;
      
      console.log('[Wrapp API] Generating PDF for invoice:', { invoiceId, locale });

      const response = await this.makeAuthenticatedRequest(
        endpoint,
        'GET'
      );

      console.log('[Wrapp API] PDF generation response:', response);

      return response;

    } catch (error: any) {
      console.error('[Wrapp API] PDF generation error:', {
        invoiceId,
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      const errorMessage = error.response?.data?.errors?.[0]?.title
        || error.response?.data?.message
        || error.response?.data?.error
        || error.message
        || 'Unknown error occurred';

      throw new Error(`Wrapp API PDF generation failed: ${errorMessage}`);
    }
  }

  /**
   * Parses the Wrapp API response into a structured format
   * 
   * @param response - Raw response from Wrapp API
   * @returns Parsed invoice response
   */
  private parseWrappInvoiceResponse(response: any): WrappInvoiceResponse {
    try {
      // Extract invoice data from response
      // Wrapp API typically returns data in format: { data: { id, attributes: {...} } }
      const invoiceData = response.data || response;
      const attributes = invoiceData.attributes || {};
      const invoiceId = invoiceData.id || '';

      const parsed: WrappInvoiceResponse = {
        success: true,
        invoiceId: invoiceId,
        invoiceNumber: attributes.num,
        pdfUrl: attributes.pdf_url,
        mark: attributes.mark,
        rawResponse: response
      };

      console.log('[Wrapp API] Parsed response:', {
        invoiceId: parsed.invoiceId,
        invoiceNumber: parsed.invoiceNumber,
        hasPdfUrl: !!parsed.pdfUrl,
        hasMark: !!parsed.mark
      });

      return parsed;

    } catch (error: any) {
      console.error('[Wrapp API] Error parsing response:', error);
      
      // Return response with raw data if parsing fails
      return {
        success: false,
        invoiceId: '',
        rawResponse: response
      };
    }
  }
}

// Export singleton instance
export const wrappApiService = new WrappApiService();