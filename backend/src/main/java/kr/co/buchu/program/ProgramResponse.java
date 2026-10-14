package kr.co.buchu.program;

import java.util.List;

public record ProgramResponse(List<Program> items, int total, String updatedAt) {}
