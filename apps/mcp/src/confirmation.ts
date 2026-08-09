export interface McpConfirmationGrantProvider {
  /**
   * Return the grant trusted by the transport boundary for this invocation.
   * The provider is deliberately separate from ToolRegistry so future
   * transports can inject authorization without coupling the registry to an
   * operating-system environment.
   */
  getGrant(): string | undefined;
}

export class StdioMcpConfirmationGrantProvider implements McpConfirmationGrantProvider {
  getGrant(): string | undefined {
    const grant = process.env.BANGUMI_MCP_CONFIRMATION_GRANT;
    return grant && grant.trim() ? grant : undefined;
  }
}
