// src/swagger.ts
import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Paycasso Backend V2 API",
      version: "1.0.0",
      description: "API documentation for Paycasso backend",
    },
    servers: [
      { url: "http://localhost:3000", description: "Local server" } 
     
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        }
      },
      schemas: {
        // You can put commonly used schemas here 
      }
    },
    security: [
      
      { BearerAuth: [] }
    ]
  },
  
  apis: [
    "./src/controllers/*.ts",
    "./src/routes/*.ts",
    "./src/**/*.ts" // Adjust the path as necessary
  ]
};

const specs = swaggerJsdoc(options);
export default specs;
